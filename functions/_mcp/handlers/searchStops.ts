import type { CityAdapter } from "../../_adapters/CityAdapter";
import type { McpContext } from "../types";
import { MCP_DEFAULTS } from "../../_core/config";
import { loadStops } from "../utils";

/**
 * Handles the 'search_stops' MCP tool invocation.
 * Searches public transit stops by stop_name or stop_id query.
 * 
 * @param args - Tool arguments containing `query`, `city` (default: 'prague'), and optional `limit`.
 * @param ctx - Cloudflare Pages Function event context.
 * @param adapter - Resolved CityAdapter for the target city.
 * @param resolvedCity - Normalized city slug (a `CITY_REGISTRY` key).
 * @returns Filtered stop list with coordinates, line list, and centroid status.
 */
export async function handleSearchStops(
    args: Record<string, unknown>,
    ctx: McpContext,
    adapter: CityAdapter,
    resolvedCity: string
): Promise<unknown> {
    const query = String(args.query || "").trim().toLowerCase();
    const limit = Number(args.limit) || MCP_DEFAULTS.RESULT_LIMIT;
    const features = await loadStops(ctx, adapter, resolvedCity);
    const filtered = features.filter((f) => {
        const nameMatch = f.properties?.stop_name?.toLowerCase().includes(query);
        const idMatch = String(f.properties?.stop_id || "").toLowerCase().includes(query);
        const isCentroid = f.properties?.is_centroid;
        return (nameMatch || idMatch) && !isCentroid;
    }).slice(0, limit);

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
            lines: f.properties?.lines || []
        }))
    };
}
