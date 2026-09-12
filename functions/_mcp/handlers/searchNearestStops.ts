import type { CityAdapter } from "../../_adapters/CityAdapter";
import type { McpContext } from "../types";
import { MCP_DEFAULTS } from "../../_core/config";
import { loadStops, rankStopsByDistance } from "../utils";

/**
 * Handles the 'search_nearest_stops' MCP tool invocation.
 * Finds transit stops closest to a given latitude and longitude.
 * 
 * @param args - Tool arguments containing `latitude`, `longitude`, optional `radius_meters`, `limit`, and `city`.
 * @param ctx - Cloudflare Pages Function event context.
 * @param adapter - Resolved CityAdapter for the target city.
 * @param resolvedCity - Normalized city slug (a `CITY_REGISTRY` key).
 * @returns Nearest stops ordered by distance in meters.
 */
export async function handleSearchNearestStops(
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

    const radiusMeters = Number(args.radius_meters) || MCP_DEFAULTS.NEAREST_STOPS_RADIUS_M;
    const limit = Number(args.limit) || MCP_DEFAULTS.RESULT_LIMIT;
    const stopsInRadius = rankStopsByDistance(await loadStops(ctx, adapter, resolvedCity), lat, lon)
        .filter((s) => s.distance <= radiusMeters);

    return {
        city: resolvedCity,
        search_location: { latitude: lat, longitude: lon },
        radius_meters: radiusMeters,
        count: Math.min(stopsInRadius.length, limit),
        stops: stopsInRadius.slice(0, limit).map(({ feature: f, distance }) => ({
            stop_id: f.properties?.stop_id,
            stop_name: f.properties?.stop_name,
            platform_code: f.properties?.platform_code || null,
            distance_meters: Math.round(distance),
            is_centroid: f.properties?.is_centroid,
            coordinates: f.geometry?.coordinates,
            lines: f.properties?.lines || []
        }))
    };
}
