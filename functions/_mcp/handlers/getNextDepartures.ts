import type { CityAdapter } from "../../_adapters/CityAdapter";
import type { McpContext } from "../types";
import { MCP_DEFAULTS } from "../../_core/config";
import { loadStops, rankStopsByDistance, loadStopDepartures, loadInfotexts, toMcpStopInfotexts, getMcpTimeContext, toMcpDeparture } from "../utils";

/**
 * Handles the 'get_next_departures' MCP tool invocation.
 * Fetches real-time departures from a stop ID, stop name search, or coordinates.
 * Includes inline stop notice banners (infotexts).
 *
 * @param args - Tool arguments containing `stop_id`, `stop_name`, `latitude`/`longitude`, `line`, `route_type`, `limit`, `city`.
 * @param ctx - Cloudflare Pages Function event context.
 * @param adapter - Resolved CityAdapter for the target city.
 * @param resolvedCity - Normalized city slug (a `CITY_REGISTRY` key).
 * @returns Departure board response with delay metadata and active infotexts.
 */
export async function handleGetNextDepartures(
    args: Record<string, unknown>,
    ctx: McpContext,
    adapter: CityAdapter,
    resolvedCity: string
): Promise<unknown> {
    let stopId = args.stop_id as string | undefined;
    let stopNameResolved: string | undefined;
    const limit = Number(args.limit) || MCP_DEFAULTS.RESULT_LIMIT;

    // 1. If stop_id is missing but stop_name is provided, search stops
    if (!stopId && args.stop_name) {
        const nameQuery = String(args.stop_name).toLowerCase();
        const match = (await loadStops(ctx, adapter, resolvedCity)).find((f) =>
            f.properties?.stop_name?.toLowerCase().includes(nameQuery)
        );
        if (match) {
            stopId = match.properties?.stop_id;
            stopNameResolved = match.properties?.stop_name;
        } else {
            return { error: `No stop found matching '${args.stop_name}' in ${resolvedCity}.` };
        }
    }

    // 2. If stop_id & stop_name are missing but latitude & longitude are provided, find closest stop
    if (!stopId && args.latitude !== undefined && args.longitude !== undefined) {
        const lat = Number(args.latitude);
        const lon = Number(args.longitude);
        if (!isNaN(lat) && !isNaN(lon)) {
            const closest = rankStopsByDistance(await loadStops(ctx, adapter, resolvedCity), lat, lon, { includeCentroids: true })[0]?.feature;
            if (closest) {
                stopId = closest.properties?.stop_id;
                stopNameResolved = closest.properties?.stop_name;
            }
        }
    }

    if (!stopId) {
        return { error: "Either 'stop_id', 'stop_name', or ('latitude' and 'longitude') must be provided." };
    }

    const [departures, infotexts] = await Promise.all([
        loadStopDepartures(ctx, adapter, resolvedCity, stopId, args, limit),
        loadInfotexts(ctx, adapter, resolvedCity)
    ]);

    const nowMs = Date.now();
    const timeContext = getMcpTimeContext(resolvedCity, nowMs);

    return {
        city: resolvedCity,
        ...timeContext,
        stop_id: stopId,
        stop_name: stopNameResolved,
        count: departures.length,
        infotexts: toMcpStopInfotexts(infotexts, stopId),
        departures: departures.map((d) => toMcpDeparture(d, timeContext.timezone, nowMs))
    };
}
