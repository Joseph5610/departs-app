import { getStopSearch, stopsAt, type SearchedStop, type StopSearch } from "../_feeds/stopSearch";
import type { AppInfotext, AppDeparture, CityRequestContext, Env } from "../_core/types";
import type { CityConfig } from "../_core/cityConfig";
import type { McpContext } from "./types";
import { CITY_REGISTRY, getCityConfig, getCityUseCases } from "../_cities";
import type { CityUseCases } from "../_domain/useCases";
import { MCP_DEFAULTS } from "../_core/config";
import { formatTime } from "../_core/utils/time";
import { normalizeRouteType } from "../_core/utils/routeTypes";
import { distanceMeters } from "../_core/utils/geo";
import { requestParts } from "../_core/utils/stopIds";

/**
 * Headers on every /mcp response: CORS for client compatibility (Claude Code, Cursor, browsers), plus
 * the hardening set api/_middleware.ts applies to /api/* — /mcp sits outside that middleware.
 */
export const MCP_HEADERS: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-session-id",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
};

/** A JSON-RPC call here is a few hundred bytes; this is orders of magnitude of headroom. */
export const MAX_MCP_BODY_BYTES = 64 * 1024;

/**
 * Reads the request body, aborting once it exceeds `maxBytes`. Returns null if it does.
 *
 * Checking the length after `request.text()` would be too late — the buffering has already happened —
 * so the stream is consumed in chunks and cancelled as soon as the budget is blown.
 */
export async function readBoundedText(request: Request, maxBytes: number): Promise<string | null> {
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) return null;

    const reader = request.body?.getReader();
    if (!reader) return "";

    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel();
            return null;
        }
        chunks.push(value);
    }

    const body = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return new TextDecoder().decode(body);
}

/**
 * Builds the `CityRequestContext` a use-case needs, straight from the MCP call's own env and
 * `waitUntil` — no `Request` to fake, since nothing downstream reads anything but the query.
 */
export function buildRequestContext(ctx: McpContext, searchParams?: Record<string, string> | URLSearchParams): CityRequestContext {
    const url = new URL('http://mcp.internal/mcp');
    if (searchParams) {
        if (searchParams instanceof URLSearchParams) {
            searchParams.forEach((v, k) => url.searchParams.append(k, v));
        } else {
            Object.entries(searchParams).forEach(([k, v]) => {
                if (v !== undefined) url.searchParams.set(k, v);
            });
        }
    }

    return {
        url,
        env: ctx.env,
        waitUntil: (promise: Promise<unknown>) => ctx.waitUntil(promise)
    };
}

/** The use-cases of the requested city, or the default one. */
export function resolveCity(citySlug: string | undefined, env: Env): { city: CityUseCases; citySlug: string } {
    const slug = (citySlug || MCP_DEFAULTS.CITY).toLowerCase();
    const cityConfig = getCityConfig(slug);
    if (!cityConfig) {
        throw new Error(`Unsupported city '${citySlug}'. Supported cities: ${Object.keys(CITY_REGISTRY).join(', ')}.`);
    }
    return { city: getCityUseCases(slug, env), citySlug: slug };
}

/** A stop nearest a point, with the `stopId` its departures are asked for: a platform names its station. */
type RankedStop = { stop: SearchedStop; distance: number; departuresId: string };

/** The city's stop search index; throws for a city without static stop data. */
function stopSearchOf(citySlug: string): { city: CityConfig; search: Promise<StopSearch> } {
    const city = getCityConfig(citySlug);
    if (!city) throw new Error(`Unsupported city '${citySlug}'.`);
    return { city, search: getStopSearch(city) };
}

/**
 * Up to `limit` platforms whose name or id contains `query`, best match first: exact name, then
 * name starting with it, then any containment; shorter names win ties, so `Hlavní nádraží` beats `Brno, Hlavní nádraží, …`.
 */
export async function findStopsByName(citySlug: string, query: string, limit: number): Promise<SearchedStop[]> {
    const { city, search: pending } = stopSearchOf(citySlug);
    const search = await pending;
    const indexes = search.byName(query, limit);
    const stops = await stopsAt(city, search, indexes);
    return indexes.flatMap(i => stops.get(i) ?? []);
}

/**
 * The station a name query means: the best-matching platform's station, whose id names every platform of
 * it, so both directions and every mode (tram, bus, metro, train) are included.
 */
export async function resolveStationByName(citySlug: string, query: string): Promise<{ stopIds: string; stopName: string } | null> {
    const { city, search: pending } = stopSearchOf(citySlug);
    const search = await pending;
    const bestIndex = search.byName(query, 1)[0];
    if (bestIndex === undefined) return null;

    const best = (await stopsAt(city, search, [bestIndex])).get(bestIndex);
    if (!best) return null;
    const station = best.station === undefined ? undefined : (await stopsAt(city, search, [best.station])).get(best.station);
    const stop = station ?? best;
    return { stopIds: stop.id, stopName: stop.name };
}

/** Up to `limit` stops within `radiusM` of the point (anywhere, when omitted), nearest first, with their distance in meters. */
export async function nearestStops(
    citySlug: string,
    lat: number,
    lon: number,
    options: { includeStations?: boolean; radiusM?: number; limit: number }
): Promise<RankedStop[]> {
    const { city, search: pending } = stopSearchOf(citySlug);
    const search = await pending;
    const ranked = search.nearest(lat, lon, options);
    const stops = await stopsAt(city, search, ranked.map(r => r.index));
    const stationRows = [...new Set([...stops.values()].flatMap(s => s.station ?? []))];
    const stations = await stopsAt(city, search, stationRows);
    const radiusM = options.radiusM ?? Infinity;
    return ranked
        .flatMap(({ index }) => {
            const stop = stops.get(index);
            if (!stop) return [];
            const [stopLon, stopLat] = stop.coordinates;
            const station = stop.station === undefined ? undefined : stations.get(stop.station);
            return [{ stop, distance: distanceMeters(lat, lon, stopLat, stopLon), departuresId: station ? `${station.id}:${stop.id}` : stop.id }];
        })
        .filter(stop => stop.distance <= radiusM)
        .sort((a, b) => a.distance - b.distance);
}

/** A stop's lines with the vehicle type as a word (`tram`), whatever form the city's stop data uses. */
function toMcpStopLines(stop: SearchedStop) {
    return stop.lines.map(line => ({ ...line, type: normalizeRouteType(line.type) }));
}

/** A stop as the stop tools answer with it. */
export function toMcpStop(stop: SearchedStop) {
    return {
        stop_id: stop.id,
        stop_name: stop.name,
        platform_code: stop.platformCode,
        is_station: stop.isStation,
        coordinates: stop.coordinates,
        lines: toMcpStopLines(stop),
    };
}

/**
 * Route type matching helper for transit types (bus, tram, metro, train, trolleybus).
 */
function matchesRouteType(departureType: string | number, routeTypeQuery: string): boolean {
    const query = String(routeTypeQuery).trim().toLowerCase();
    const typeStr = String(departureType).trim().toLowerCase();

    if (query === typeStr) return true;

    if (query === 'rail' || query === 'train') return typeStr === 'train';
    if (query === 'subway' || query === 'metro') return typeStr === 'metro';

    return false;
}

/**
 * The city's timezone and current local time, so MCP clients can read times without doing
 * timezone or DST arithmetic themselves.
 */
export function getMcpTimeContext(citySlug: string, nowMs: number) {
    const timezone = getCityConfig(citySlug)?.timezone ?? 'UTC';
    return { timezone, current_local_time: formatTime(new Date(nowMs), timezone) };
}

/** Departure as exposed to MCP clients, with city-local `HH:mm` times and minutes until departure. */
export function toMcpDeparture(d: AppDeparture, timezone: string, nowMs: number) {
    const departure = new Date(d.timestamp);
    return {
        line: d.line,
        type: d.type,
        headsign: d.headsign,
        timestamp: d.timestamp,
        scheduled: d.scheduled,
        local_time: formatTime(departure, timezone),
        scheduled_local_time: formatTime(new Date(d.scheduled), timezone),
        minutes_until: Math.round((departure.getTime() - nowMs) / 60000),
        delay_seconds: d.delay ?? null,
        delay_minutes: d.delay != null ? Math.round((d.delay) / 60 * 10) / 10 : null,
        is_wheelchair_accessible: d.is_wheelchair_accessible ?? null,
        platform: d.platform ?? null,
        trip_id: d.tripId,
        vehicle_id: d.vehicleId
    };
}

/**
 * A stop's departures, narrowed by the tool's optional `line` and `route_type` arguments and
 * capped at `limit`. `stopId` may be a comma-joined platform list, each platform answered on its own, or a
 * `station:platforms` value, answered as one stop.
 */
export async function loadStopDepartures(
    ctx: McpContext,
    city: CityUseCases,
    stopId: string,
    args: Record<string, unknown>,
    limit: number
): Promise<AppDeparture[]> {
    const searchParams = new URLSearchParams();
    searchParams.set("limit", String(limit));
    for (const id of stopId.includes(':') ? [stopId] : stopId.split(',')) {
        if (id.trim()) searchParams.append("stopId", id.trim());
    }

    const departuresCtx = buildRequestContext(ctx, searchParams);
    let departures = (await city.departures.getDepartures(departuresCtx))?.departures || [];

    if (args.line) {
        const lineQuery = String(args.line).trim().toLowerCase();
        departures = departures.filter((d) => String(d.line).toLowerCase() === lineQuery);
    }
    if (args.route_type) {
        const routeTypeQuery = String(args.route_type);
        departures = departures.filter((d) => matchesRouteType(d.type, routeTypeQuery));
    }

    // Departure boards keep recently departed trips for the app to reconcile with live positions; MCP clients want what is still to come.
    const nowMs = Date.now();
    return departures.filter((d) => Date.parse(d.timestamp) >= nowMs).slice(0, limit);
}

/** All of the city's stop notice banners (infotexts); empty if they cannot be loaded. */
export async function loadInfotexts(ctx: McpContext, city: CityUseCases, citySlug: string): Promise<AppInfotext[]> {
    try {
        const infotexts = await city.infotexts.getInfotexts(buildRequestContext(ctx));
        return Array.isArray(infotexts) ? infotexts : [];
    } catch (e) {
        console.error(`Failed to load infotexts for ${citySlug}:`, e);
        return [];
    }
}

/** The infotexts that name any platform of `stopId`, as exposed to MCP clients. */
export function toMcpStopInfotexts(infotexts: AppInfotext[], stopId: string) {
    // `stop_id` may be a comma-joined platform list; match the parts exactly.
    const targetIds = new Set(requestParts(stopId).map((id) => id.toLowerCase()));
    if (targetIds.size === 0) return [];

    return infotexts
        .filter((info) => info.relatedStopIds?.some((sId) => targetIds.has(String(sId).trim().toLowerCase())) ?? false)
        .map((info) => ({
            id: info.id,
            text: info.text,
            text_en: info.textEn,
            priority: info.priority
        }));
}
