import type { AppDeparture, AppVehicleCollection, AppVehicleFeature } from "../../../../_core/types";
import type { GtfsDepartureTuple } from "./types";
import type { GtfsRoute } from "../../core/gtfs-data";
import { normalizeRouteType } from "../../../../_core/utils/routeTypes";
import { GTFS_CONFIG } from "../../core/config";

export class DeparturesMapper {
    
    /**
     * Maps raw GTFS static departure tuples into application-specific AppDeparture structures.
     * 
     * This method handles:
     * 1. Filtering out departures that are outside the past/future time windows.
     * 2. Indexing real-time vehicles by `gtfs_trip_id` for fast O(1) lookups.
     * 3. Merging static scheduled data with real-time delays, vehicle IDs, and AC/wheelchair metadata.
     * 4. Resurrecting departed vehicles that the backend cache might have prematurely dropped,
     *    allowing the frontend to render them based on real-time delays.
     * 
     * @param deps An array of static GTFS departure tuples (compact arrays) for a given stop.
     * @param routes A dictionary of GTFS routes used to resolve route names, colors, and types.
     * @param rtVehicles The latest cached collection of real-time vehicles, used to inject live delays and metadata.
     * @returns A sorted, mapped array of AppDeparture objects ready for frontend consumption, capped at 150 entries.
     */
    static mapDepartures(
        deps: Array<{ stopId: string, tuple: GtfsDepartureTuple }>, 
        routes: Record<string, GtfsRoute>, 
        rtVehicles: AppVehicleCollection | null
    ): AppDeparture[] {
        const now = Date.now();
        
        const filtered = deps.filter(d => {
            const ts = d.tuple[3];
            return ts >= now - GTFS_CONFIG.DEPARTURES_PAST_WINDOW_MS && ts <= now + GTFS_CONFIG.DEPARTURES_FUTURE_WINDOW_MS;
        });

        const tripIndex = new Map<string, NonNullable<AppVehicleFeature['properties']>>();

        if (rtVehicles) {
            for (const f of rtVehicles.features) {
                const props = f.properties;
                const tripId = props.gtfs_trip_id;
                if (tripId && props.vehicle_id) {
                    tripIndex.set(tripId, props);
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
                const rtProps = tripIndex.get(trip_id);
                if (rtProps) {
                    vId = rtProps.vehicle_id || undefined;
                    if (typeof rtProps.delay === 'number') {
                        delaySecs = rtProps.delay;
                    }
                    if (rtProps.vehicle_descriptor?.is_air_conditioned !== undefined) {
                        isAirConditioned = rtProps.vehicle_descriptor.is_air_conditioned;
                    }
                    if (rtProps.vehicle_descriptor?.is_wheelchair_accessible !== undefined) {
                        isWheelchairAccessible = rtProps.vehicle_descriptor.is_wheelchair_accessible;
                    }
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
            .filter(d => d.rtTimestampMs >= now - GTFS_CONFIG.DEPARTURES_RESURRECT_WINDOW_MS)
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
