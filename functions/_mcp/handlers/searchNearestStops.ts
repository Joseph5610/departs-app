import { MCP_DEFAULTS } from "../../_core/config";
import { nearestStops, toMcpStop } from "../utils";

/**
 * Handles the 'search_nearest_stops' MCP tool invocation.
 * Finds transit stops closest to a given latitude and longitude.
 * 
 * @param args - Tool arguments containing `latitude`, `longitude`, optional `radius_meters`, `limit`, and `city`.
 * @param resolvedCity - Normalized city slug (a `CITY_REGISTRY` key).
 * @returns Nearest stops ordered by distance in meters.
 */
export async function handleSearchNearestStops(
    args: Record<string, unknown>,
    resolvedCity: string
): Promise<unknown> {
    const lat = Number(args.latitude);
    const lon = Number(args.longitude);
    if (isNaN(lat) || isNaN(lon)) {
        return { error: "Valid 'latitude' and 'longitude' numeric coordinates are required." };
    }

    const radiusMeters = Number(args.radius_meters) || MCP_DEFAULTS.NEAREST_STOPS_RADIUS_M;
    const limit = Number(args.limit) || MCP_DEFAULTS.RESULT_LIMIT;
    const stopsInRadius = await nearestStops(resolvedCity, lat, lon, { radiusM: radiusMeters, limit });

    return {
        city: resolvedCity,
        search_location: { latitude: lat, longitude: lon },
        radius_meters: radiusMeters,
        count: Math.min(stopsInRadius.length, limit),
        stops: stopsInRadius.slice(0, limit).map(({ stop, distance }) => {
            const { stop_id, stop_name, platform_code, ...rest } = toMcpStop(stop);
            return { stop_id, stop_name, platform_code, distance_meters: Math.round(distance), ...rest };
        })
    };
}
