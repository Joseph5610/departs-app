import type { CityAdapter } from "../../_adapters/CityAdapter";
import type { McpContext } from "../types";
import { MCP_DEFAULTS } from "../../_core/config";
import { loadStops, rankStopsByDistance, loadStopDepartures, loadInfotexts, toMcpStopInfotexts, getMcpTimeContext, toMcpDeparture } from "../utils";

/**
 * Handles the 'get_nearest_departures' MCP tool invocation.
 * Fetches departures for all stops within radius of user latitude and longitude.
 *
 * @param args - Tool arguments containing `latitude`, `longitude`, optional `radius_meters`, `line`, `route_type`, `limit`, `city`.
 * @param ctx - Cloudflare Pages Function event context.
 * @param adapter - Resolved CityAdapter for the target city.
 * @param resolvedCity - Normalized city slug (a `CITY_REGISTRY` key).
 * @returns Grouped departure boards for nearest stops with distance and active infotexts.
 */
export async function handleGetNearestDepartures(
    args: Record<string, unknown>,
    ctx: McpContext,
    adapter: CityAdapter,
    resolvedCity: string
): Promise<unknown> {
    const lat = Number(args.latitude);
    const lon = Number(args.longitude);
    if (isNaN(lat) || isNaN(lon)) {
        return { error: "Valid 'latitude' and 'longitude' numeric coordinates are required." };
    }

    const radiusMeters = Number(args.radius_meters) || MCP_DEFAULTS.NEAREST_DEPARTURES_RADIUS_M;
    const limit = Number(args.limit) || MCP_DEFAULTS.RESULT_LIMIT;
    const [stops, infotexts] = await Promise.all([
        loadStops(ctx, adapter, resolvedCity),
        loadInfotexts(ctx, adapter, resolvedCity)
    ]);

    const ranked = rankStopsByDistance(stops, lat, lon);
    let nearby = ranked.filter((s) => s.distance <= radiusMeters);
    if (nearby.length === 0) {
        nearby = ranked.slice(0, MCP_DEFAULTS.NEAREST_DEPARTURES_FALLBACK_STOPS);
    } else {
        nearby = nearby.slice(0, MCP_DEFAULTS.NEAREST_DEPARTURES_MAX_STOPS);
    }

    const nowMs = Date.now();
    const timeContext = getMcpTimeContext(resolvedCity, nowMs);

    // Stops are independent, so fetch them in one wave; `nearby` is pre-sorted, so order is preserved.
    const settled = await Promise.all(nearby.map(async ({ feature, distance }) => {
        const sId = feature.properties?.stop_id;
        if (!sId) return null;

        try {
            const departures = await loadStopDepartures(ctx, adapter, resolvedCity, sId, args, limit);
            const stopInfotexts = toMcpStopInfotexts(infotexts, sId);
            if (departures.length === 0 && stopInfotexts.length === 0) return null;

            return {
                stop_id: sId,
                stop_name: feature.properties?.stop_name,
                distance_meters: Math.round(distance),
                infotexts: stopInfotexts,
                departures: departures.map((d) => toMcpDeparture(d, timeContext.timezone, nowMs))
            };
        } catch (e) {
            console.error(`Failed to load departures for stop ${sId}:`, e);
            return null;
        }
    }));

    const nearestStopsResult = settled.filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    return {
        city: resolvedCity,
        ...timeContext,
        search_location: { latitude: lat, longitude: lon },
        radius_meters: radiusMeters,
        stops_count: nearestStopsResult.length,
        nearest_stops: nearestStopsResult
    };
}
