import type { CityUseCases } from "../../_domain/use-cases";
import type { McpContext } from "../types";
import { MCP_DEFAULTS } from "../../_core/config";
import { resolveStationByName, nearestStops, loadStopDepartures, loadInfotexts, toMcpStopInfotexts, getMcpTimeContext, toMcpDeparture } from "../utils";

/**
 * Handles the 'get_next_departures' MCP tool invocation.
 * Fetches real-time departures from a stop ID, stop name search, or coordinates.
 * Includes inline stop notice banners (infotexts).
 *
 * @param args - Tool arguments containing `stop_id`, `stop_name`, `latitude`/`longitude`, `line`, `route_type`, `limit`, `city`.
 * @param ctx - Cloudflare Pages Function event context.
 * @param city - The target city's use-cases.
 * @param resolvedCity - Normalized city slug (a `CITY_REGISTRY` key).
 * @returns Departure board response with delay metadata and active infotexts.
 */
export async function handleGetNextDepartures(
    args: Record<string, unknown>,
    ctx: McpContext,
    city: CityUseCases,
    resolvedCity: string
): Promise<unknown> {
    let stopId = args.stop_id as string | undefined;
    let stopNameResolved: string | undefined;
    const limit = Number(args.limit) || MCP_DEFAULTS.RESULT_LIMIT;

    // 1. If stop_id is missing but stop_name is provided, search stops
    if (!stopId && args.stop_name) {
        const station = await resolveStationByName(resolvedCity, String(args.stop_name));
        if (station) {
            stopId = station.stopIds;
            stopNameResolved = station.stopName;
        } else {
            return { error: `No stop found matching '${args.stop_name}' in ${resolvedCity}.` };
        }
    }

    // 2. If stop_id & stop_name are missing but latitude & longitude are provided, find closest stop
    if (!stopId && args.latitude !== undefined && args.longitude !== undefined) {
        const lat = Number(args.latitude);
        const lon = Number(args.longitude);
        if (!isNaN(lat) && !isNaN(lon)) {
            const closest = (await nearestStops(resolvedCity, lat, lon, { includeCentroids: true, limit: 1 }))[0]?.feature;
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
        loadStopDepartures(ctx, city, stopId, args, limit),
        loadInfotexts(ctx, city, resolvedCity)
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
