import type { AppStopCollection } from "../../_core/types";
import type { CityAdapter } from "../../_adapters/CityAdapter";
import type { McpContext } from "../types";
import { createMockContext, calculateHaversineDistanceMeters } from "../utils";

/**
 * Handles the 'search_nearest_stops' MCP tool invocation.
 * Finds transit stops closest to a given latitude and longitude.
 * 
 * @param args - Tool arguments containing `latitude`, `longitude`, optional `radius_meters`, `limit`, and `city`.
 * @param ctx - Cloudflare Pages Function event context.
 * @param adapter - Resolved CityAdapter for the target city.
 * @param resolvedCity - Normalized city slug ('prague' or 'brno').
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

    const radiusMeters = Number(args.radius_meters) || 1000;
    const limit = Number(args.limit) || 10;
    const searchCtx = createMockContext(ctx, resolvedCity, `/api/${resolvedCity}/stops`);
    const stopsData = await adapter.handleStops(searchCtx) as AppStopCollection;

    const stopsWithDistance: Array<{ feature: AppStopCollection['features'][0]; distance: number }> = [];

    for (const f of stopsData?.features || []) {
        if (f.geometry?.coordinates && !f.properties?.is_centroid) {
            const [stopLon, stopLat] = f.geometry.coordinates;
            const dist = calculateHaversineDistanceMeters(lat, lon, stopLat, stopLon);
            if (dist <= radiusMeters) {
                stopsWithDistance.push({ feature: f, distance: Math.round(dist) });
            }
        }
    }

    stopsWithDistance.sort((a, b) => a.distance - b.distance);

    return {
        city: resolvedCity,
        search_location: { latitude: lat, longitude: lon },
        radius_meters: radiusMeters,
        count: Math.min(stopsWithDistance.length, limit),
        stops: stopsWithDistance.slice(0, limit).map(({ feature: f, distance }) => ({
            stop_id: f.properties?.stop_id,
            stop_name: f.properties?.stop_name,
            platform_code: f.properties?.platform_code || null,
            distance_meters: distance,
            is_centroid: f.properties?.is_centroid,
            coordinates: f.geometry?.coordinates,
            lines: f.properties?.lines || []
        }))
    };
}
