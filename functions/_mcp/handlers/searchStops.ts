import { MCP_DEFAULTS } from "../../_core/config";
import { findStopsByName, toMcpStopLines } from "../utils";

/**
 * Handles the 'search_stops' MCP tool invocation.
 * Searches public transit stops by stop_name or stop_id query.
 * 
 * @param args - Tool arguments containing `query`, `city` (default: 'prague'), and optional `limit`.
 * @param resolvedCity - Normalized city slug (a `CITY_REGISTRY` key).
 * @returns Filtered stop list with coordinates, line list, and centroid status.
 */
export async function handleSearchStops(
    args: Record<string, unknown>,
    resolvedCity: string
): Promise<unknown> {
    const limit = Number(args.limit) || MCP_DEFAULTS.RESULT_LIMIT;
    const filtered = await findStopsByName(resolvedCity, String(args.query || ""), limit);

    return {
        city: resolvedCity,
        query: args.query,
        count: filtered.length,
        stops: filtered.map((f) => ({
            stop_id: f.properties?.stop_id,
            stop_name: f.properties?.stop_name,
            platform_code: f.properties?.platform_code || null,
            is_centroid: f.properties?.is_centroid,
            coordinates: f.geometry?.coordinates,
            lines: toMcpStopLines(f)
        }))
    };
}
