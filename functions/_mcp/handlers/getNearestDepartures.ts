import type { AppStopCollection, AppDepartureResponse } from "../../_core/types";
import type { CityAdapter } from "../../_adapters/CityAdapter";
import type { McpContext } from "../types";
import { createMockContext, calculateHaversineDistanceMeters, matchesRouteType, getMatchingInfotexts } from "../utils";

/**
 * Handles the 'get_nearest_departures' MCP tool invocation.
 * Fetches departures for all stops within radius of user latitude and longitude.
 * 
 * @param args - Tool arguments containing `latitude`, `longitude`, optional `radius_meters`, `line`, `route_type`, `limit`, `city`.
 * @param ctx - Cloudflare Pages Function event context.
 * @param adapter - Resolved CityAdapter for the target city.
 * @param resolvedCity - Normalized city slug ('prague' or 'brno').
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

    const radiusMeters = Number(args.radius_meters) || 500;
    const limit = Number(args.limit) || 10;
    const searchCtx = createMockContext(ctx, resolvedCity, `/api/${resolvedCity}/stops`);
    const stopsData = await adapter.handleStops(searchCtx) as AppStopCollection;

    const stopsWithDistance: Array<{ feature: AppStopCollection['features'][0]; distance: number }> = [];

    for (const f of stopsData?.features || []) {
        if (f.geometry?.coordinates && !f.properties?.is_centroid) {
            const [stopLon, stopLat] = f.geometry.coordinates;
            const dist = calculateHaversineDistanceMeters(lat, lon, stopLat, stopLon);
            stopsWithDistance.push({ feature: f, distance: dist });
        }
    }

    stopsWithDistance.sort((a, b) => a.distance - b.distance);

    let nearby = stopsWithDistance.filter((s) => s.distance <= radiusMeters);
    if (nearby.length === 0) {
        nearby = stopsWithDistance.slice(0, 3);
    } else {
        nearby = nearby.slice(0, 5);
    }

    const nearestStopsResult = [];

    for (const { feature, distance } of nearby) {
        const sId = feature.properties?.stop_id;
        const sName = feature.properties?.stop_name;
        if (!sId) continue;

        const searchParams = new URLSearchParams();
        searchParams.set("limit", String(limit));
        sId.split(',').forEach(id => {
            if (id.trim()) searchParams.append("stopId", id.trim());
        });
        
        const mockCtx = createMockContext(ctx, resolvedCity, `/api/${resolvedCity}/departures`, searchParams);

        try {
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

            const stopInfotexts = await getMatchingInfotexts(ctx, adapter, resolvedCity, sId);

            if (departures.length > 0 || stopInfotexts.length > 0) {
                nearestStopsResult.push({
                    stop_id: sId,
                    stop_name: sName,
                    distance_meters: Math.round(distance),
                    infotexts: stopInfotexts.map((i) => ({
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
                });
            }
        } catch {
            // Skip stop if departure request fails
        }
    }

    return {
        city: resolvedCity,
        search_location: { latitude: lat, longitude: lon },
        radius_meters: radiusMeters,
        stops_count: nearestStopsResult.length,
        nearest_stops: nearestStopsResult
    };
}
