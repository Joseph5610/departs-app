import type { AppDeparture, AppVehicleCollection } from "../../../../_core/types";
import type { GtfsDepartureTuple } from "./types";
import type { GtfsRoute } from "../../core/gtfs-data";

export class DeparturesMapper {
    static mapDepartures(
        deps: Array<{ stopId: string, tuple: GtfsDepartureTuple }>, 
        routes: Record<string, GtfsRoute>, 
        rtVehicles: AppVehicleCollection | null
    ): AppDeparture[] {
        const now = Date.now();
        
        const PAST_WINDOW_MS = 120 * 60 * 1000; // 2 hours
        const FUTURE_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours

        const filtered = deps.filter(d => {
            const ts = d.tuple[3];
            return ts >= now - PAST_WINDOW_MS && ts <= now + FUTURE_WINDOW_MS;
        });

        const vehicleIndex = new Map<string, string>();
        const delayIndex = new Map<string, number>();
        if (rtVehicles) {
            for (const f of rtVehicles.features) {
                const vId = f.properties.vehicle_id;
                const tripId = f.properties.gtfs_trip_id;
                const delay = f.properties.delay;

                if (vId && tripId) {
                    vehicleIndex.set(tripId, vId);
                    delayIndex.set(tripId, delay);
                }
            }
        }

        const mapped = filtered.map(d => {
            const { stopId, tuple } = d;
            const [trip_id, route_id, headsign, timestamp_ms] = tuple;
            const route = routes[route_id];
            
            let vId: string | undefined = undefined;
            let delaySecs = 0;

            if (rtVehicles) {
                vId = vehicleIndex.get(trip_id);
                const rtDelay = delayIndex.get(trip_id);
                if (typeof rtDelay === 'number') {
                    delaySecs = rtDelay;
                }
            }

            const rtTimestampMs = timestamp_ms + (delaySecs * 1000);

            return {
                tripId: trip_id,
                vehicleId: vId,
                line: route ? String(route.name) : route_id,
                type: route ? String(route.type) : 'unknown', 
                directionId: '0', 
                headsign: headsign,
                scheduledTimestampMs: timestamp_ms,
                rtTimestampMs,
                delay: delaySecs,
                isCanceled: false,
                route_color: route ? String(route.route_color) : undefined,
                stopId: stopId
            };
        });

        return mapped
            .filter(d => d.rtTimestampMs >= now - 60000)
            .sort((a, b) => a.rtTimestampMs - b.rtTimestampMs)
            .slice(0, 150)
            .map(d => ({
                tripId: d.tripId,
                vehicleId: d.vehicleId,
                line: d.line,
                type: d.type, 
                directionId: d.directionId, 
                headsign: d.headsign,
                scheduled: new Date(d.scheduledTimestampMs).toISOString(),
                timestamp: new Date(d.rtTimestampMs).toISOString(),
                delay: d.delay,
                isCanceled: d.isCanceled,
                route_color: d.route_color,
                stopId: d.stopId
            } as AppDeparture));
    }
}
