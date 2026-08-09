import type { AppDeparture, AppVehicleCollection } from "../../../../_core/types";
import type { GtfsDepartureTuple } from "./types";
import type { GtfsRoute } from "../../core/gtfs-data";
import { normalizeRouteType } from "../../../../_core/utils/routeTypes";

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
        const delayIndex = new Map<string, number | null>();
        const acIndex = new Map<string, boolean | null>();
        const wheelchairIndex = new Map<string, boolean | null>();

        if (rtVehicles) {
            for (const f of rtVehicles.features) {
                const vId = f.properties.vehicle_id;
                const tripId = f.properties.gtfs_trip_id;
                const delay = f.properties.delay;
                const desc = f.properties.vehicle_descriptor;

                if (vId && tripId) {
                    vehicleIndex.set(tripId, vId);
                    delayIndex.set(tripId, delay);
                    if (desc) {
                        if (desc.is_air_conditioned !== undefined) {
                            acIndex.set(tripId, desc.is_air_conditioned);
                        }
                        if (desc.is_wheelchair_accessible !== undefined) {
                            wheelchairIndex.set(tripId, desc.is_wheelchair_accessible);
                        }
                    }
                }
            }
        }

        const mapped = filtered.map(d => {
            const { stopId, tuple } = d;
            const [trip_id, route_id, headsign, timestamp_ms, wheelchair_accessible, is_request_stop_num] = tuple;
            const route = routes[route_id];
            
            let vId: string | undefined = undefined;
            let delaySecs: number | null = null;
            let isAirConditioned: boolean | null = null;
            let isWheelchairAccessible: boolean | null = null;

            if (wheelchair_accessible === 1) {
                isWheelchairAccessible = true;
            } else if (wheelchair_accessible === 2) {
                isWheelchairAccessible = false;
            }

            if (rtVehicles) {
                vId = vehicleIndex.get(trip_id);
                const rtDelay = delayIndex.get(trip_id);
                if (typeof rtDelay === 'number') {
                    delaySecs = rtDelay;
                }
                const rtAc = acIndex.get(trip_id);
                if (rtAc !== undefined) {
                    isAirConditioned = rtAc;
                }
                const rtWheelchair = wheelchairIndex.get(trip_id);
                if (rtWheelchair !== undefined) {
                    isWheelchairAccessible = rtWheelchair;
                }
            }

            const rtTimestampMs = timestamp_ms + ((delaySecs || 0) * 1000);

            return {
                tripId: trip_id,
                vehicleId: vId,
                line: route ? String(route.name) : route_id,
                type: normalizeRouteType(route ? route.type : 'unknown'), 
                directionId: '0', 
                headsign: headsign,
                scheduledTimestampMs: timestamp_ms,
                rtTimestampMs,
                delay: delaySecs,
                isCanceled: false,
                route_color: route ? String(route.route_color) : undefined,
                stopId: stopId,
                is_air_conditioned: isAirConditioned,
                is_wheelchair_accessible: isWheelchairAccessible,
                is_request_stop: is_request_stop_num === 1
            };
        });

        return mapped
            // Send departures that were scheduled/expected up to 15 mins ago to the frontend.
            // The backend cache for delays often misses, so it thinks the bus already left.
            // By sending it anyway, the frontend can apply the live map delay and resurrect it.
            .filter(d => d.rtTimestampMs >= now - (15 * 60000))
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
                stopId: d.stopId,
                is_air_conditioned: d.is_air_conditioned,
                is_wheelchair_accessible: d.is_wheelchair_accessible,
                is_request_stop: d.is_request_stop
            } as AppDeparture));
    }
}
