import type { AppStopCollection, AppDepartureResponse } from "../../_core/types";
import type { CityAdapter } from "../../_adapters/CityAdapter";
import type { McpContext } from "../types";
import { createMockContext, calculateHaversineDistanceMeters, matchesRouteType, getMatchingInfotexts } from "../utils";

/**
 * Handles the 'get_next_departures' MCP tool invocation.
 * Fetches real-time departures from a stop ID, stop name search, or coordinates.
 * Includes inline stop notice banners (infotexts).
 * 
 * @param args - Tool arguments containing `stop_id`, `stop_name`, `latitude`/`longitude`, `line`, `route_type`, `limit`, `city`.
 * @param ctx - Cloudflare Pages Function event context.
 * @param adapter - Resolved CityAdapter for the target city.
 * @param resolvedCity - Normalized city slug ('prague' or 'brno').
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
    const limit = Number(args.limit) || 10;

    // 1. If stop_id is missing but stop_name is provided, search stops
    if (!stopId && args.stop_name) {
        const searchCtx = createMockContext(ctx, resolvedCity, `/api/${resolvedCity}/stops`);
        const stopsData = await adapter.handleStops(searchCtx) as AppStopCollection;
        const match = (stopsData?.features || []).find((f) =>
            f.properties?.stop_name?.toLowerCase().includes(String(args.stop_name).toLowerCase())
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
            const searchCtx = createMockContext(ctx, resolvedCity, `/api/${resolvedCity}/stops`);
            const stopsData = await adapter.handleStops(searchCtx) as AppStopCollection;
            let minDistance = Infinity;
            let closest = null;

            for (const f of stopsData?.features || []) {
                if (f.geometry?.coordinates) {
                    const [stopLon, stopLat] = f.geometry.coordinates;
                    const dist = calculateHaversineDistanceMeters(lat, lon, stopLat, stopLon);
                    if (dist < minDistance) {
                        minDistance = dist;
                        closest = f;
                    }
                }
            }
            if (closest) {
                stopId = closest.properties?.stop_id;
                stopNameResolved = closest.properties?.stop_name;
            }
        }
    }

    if (!stopId) {
        return { error: "Either 'stop_id', 'stop_name', or ('latitude' and 'longitude') must be provided." };
    }

    const searchParams = new URLSearchParams();
    searchParams.set("limit", String(limit));
    stopId.split(',').forEach(id => {
        if (id.trim()) {
            searchParams.append("stopId", id.trim());
        }
    });

    const mockCtx = createMockContext(ctx, resolvedCity, `/api/${resolvedCity}/departures`, searchParams);
    const departuresData = await adapter.handleDepartures(mockCtx) as AppDepartureResponse;

    let departures = departuresData?.departures || [];
    if (args.line) {
        const lineQuery = String(args.line).trim().toLowerCase();
        departures = departures.filter((d) => String(d.line).toLowerCase() === lineQuery);
    }

    if (args.route_type) {
        const rType = String(args.route_type);
        departures = departures.filter((d) => matchesRouteType(d.type, rType));
    }

    const matchingInfotexts = await getMatchingInfotexts(ctx, adapter, resolvedCity, stopId);

    return {
        city: resolvedCity,
        stop_id: stopId,
        stop_name: stopNameResolved,
        count: departures.slice(0, limit).length,
        infotexts: matchingInfotexts.map((i) => ({
            id: i.id,
            text: i.text,
            text_en: i.textEn,
            priority: i.priority
        })),
        departures: departures.slice(0, limit).map((d) => ({
            line: d.line,
            type: d.type,
            headsign: d.headsign,
            timestamp: d.timestamp,
            scheduled: d.scheduled,
            delay_seconds: d.delay ?? null,
            delay_minutes: d.delay != null ? Math.round((d.delay) / 60 * 10) / 10 : null,
            is_wheelchair_accessible: d.is_wheelchair_accessible ?? null,
            platform: d.platform ?? null,
            trip_id: d.tripId,
            vehicle_id: d.vehicleId
        }))
    };
}
