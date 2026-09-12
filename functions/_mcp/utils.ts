import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppInfotext, AppDeparture, AppStopCollection } from "../_core/types";
import type { McpContext } from "./types";
import { CITY_REGISTRY, getCityConfig } from "../_core/city-config";
import { MCP_DEFAULTS } from "../_core/config";
import { getAdapter, type CityAdapter } from "../_adapters/CityAdapter";
import { formatTime } from "../_core/utils/time";
import { distanceMeters } from "../_core/utils/geo";

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
 * Creates a synthetic EventContext for invoking CityAdapter methods.
 * Reuses 100% of underlying API caching, normalization, and fetch wrappers.
 */
export function createMockContext(
    ctx: EventContext<Env, string, unknown>,
    citySlug: string,
    urlPath: string,
    searchParams?: Record<string, string> | URLSearchParams
): EventContext<Env, string, unknown> {
    const url = new URL(`https://departs.app${urlPath}`);
    if (searchParams) {
        if (searchParams instanceof URLSearchParams) {
            searchParams.forEach((v, k) => url.searchParams.append(k, v));
        } else {
            Object.entries(searchParams).forEach(([k, v]) => {
                if (v !== undefined) url.searchParams.set(k, v);
            });
        }
    }

    const request = new Request(url.toString(), {
        headers: {
            'User-Agent': 'departs-mcp-server/1.0',
            'Accept': 'application/json'
        }
    });

    return {
        request,
        env: ctx.env,
        params: { city: citySlug },
        functionPath: urlPath,
        data: {},
        next: async () => new Response("Not found", { status: 404 }),
        waitUntil: (promise: Promise<unknown>) => ctx.waitUntil(promise)
    } as unknown as EventContext<Env, string, unknown>;
}

/**
 * Helper to get CityAdapter for a given city slug.
 */
export function resolveAdapter(citySlug?: string): { adapter: CityAdapter; citySlug: string } {
    const slug = (citySlug || MCP_DEFAULTS.CITY).toLowerCase();
    const cityConfig = getCityConfig(slug);
    if (!cityConfig) {
        throw new Error(`Unsupported city '${citySlug}'. Supported cities: ${Object.keys(CITY_REGISTRY).join(', ')}.`);
    }
    return { adapter: getAdapter(cityConfig), citySlug: slug };
}

type StopFeature = AppStopCollection['features'][number];
type RankedStop = { feature: StopFeature; distance: number };

/** All stops of the city, through the adapter's cached stops pipeline. */
export async function loadStops(ctx: McpContext, adapter: CityAdapter, citySlug: string): Promise<StopFeature[]> {
    const stopsData = await adapter.handleStops(createMockContext(ctx, citySlug, `/api/${citySlug}/stops`));
    return stopsData?.features || [];
}

/** Stops with coordinates, nearest first, paired with their distance in meters from the given point. */
export function rankStopsByDistance(
    stops: StopFeature[],
    lat: number,
    lon: number,
    { includeCentroids = false }: { includeCentroids?: boolean } = {}
): RankedStop[] {
    const ranked: RankedStop[] = [];
    for (const feature of stops) {
        if (!feature.geometry?.coordinates || (!includeCentroids && feature.properties?.is_centroid)) continue;
        const [stopLon, stopLat] = feature.geometry.coordinates;
        ranked.push({ feature, distance: distanceMeters(lat, lon, stopLat, stopLon) });
    }
    return ranked.sort((a, b) => a.distance - b.distance);
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
 * capped at `limit`. `stopId` may be a comma-joined platform list.
 */
export async function loadStopDepartures(
    ctx: McpContext,
    adapter: CityAdapter,
    citySlug: string,
    stopId: string,
    args: Record<string, unknown>,
    limit: number
): Promise<AppDeparture[]> {
    const searchParams = new URLSearchParams();
    searchParams.set("limit", String(limit));
    for (const id of stopId.split(',')) {
        if (id.trim()) searchParams.append("stopId", id.trim());
    }

    const departuresCtx = createMockContext(ctx, citySlug, `/api/${citySlug}/departures`, searchParams);
    let departures = (await adapter.handleDepartures(departuresCtx))?.departures || [];

    if (args.line) {
        const lineQuery = String(args.line).trim().toLowerCase();
        departures = departures.filter((d) => String(d.line).toLowerCase() === lineQuery);
    }
    if (args.route_type) {
        const routeTypeQuery = String(args.route_type);
        departures = departures.filter((d) => matchesRouteType(d.type, routeTypeQuery));
    }

    return departures.slice(0, limit);
}

/** All of the city's stop notice banners (infotexts); empty if they cannot be loaded. */
export async function loadInfotexts(ctx: McpContext, adapter: CityAdapter, citySlug: string): Promise<AppInfotext[]> {
    try {
        const infotexts = await adapter.handleInfotexts(createMockContext(ctx, citySlug, `/api/${citySlug}/infotexts`));
        return Array.isArray(infotexts) ? infotexts : [];
    } catch (e) {
        console.error(`Failed to load infotexts for ${citySlug}:`, e);
        return [];
    }
}

/** The infotexts that name any platform of `stopId`, as exposed to MCP clients. */
export function toMcpStopInfotexts(infotexts: AppInfotext[], stopId: string) {
    // `stop_id` may be a comma-joined platform list or `centroid-` prefixed; match the parts exactly.
    const targetIds = new Set(
        stopId
            .replace(/^centroid-/i, '')
            .split(',')
            .map((id) => id.trim().toLowerCase())
            .filter((id) => id.length > 0)
    );
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
