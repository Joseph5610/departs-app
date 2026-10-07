import type { AppDeparture, AppDepartureFeeder, AppVehicleCollection, AppVehicleProperties } from "../../../_core/types";
import type { GtfsDepartureTuple, GtfsFeederTuple } from "../../../_feeds/gtfs/types";
import { mapContinuation } from "../../../_feeds/gtfs/continuations";
import type { GtfsRoute } from "../../../_feeds/gtfs/gtfsData";
import { normalizeRouteType } from "../../../_core/utils/routeTypes";
import { GTFS_CONFIG } from "../../../_feeds/gtfs/config";

/** Live vehicles by the trip they serve, for joining them to departures. */
export function indexVehiclesByTrip(rtVehicles: AppVehicleCollection | null): Map<string, AppVehicleProperties> {
    const byTrip = new Map<string, AppVehicleProperties>();
    for (const f of rtVehicles?.features ?? []) {
        const props = f.properties;
        if (props.gtfs_trip_id && props.vehicle_id) byTrip.set(props.gtfs_trip_id, props);
    }
    return byTrip;
}

/**
 * A stop's timetable tuples as departures with live delay, vehicle and equipment joined in, within the
 * past/future windows; recently past ones are kept for the app to revive with its live delay.
 */
export function mapDepartures(
    deps: Array<{ stopId: string, tuple: GtfsDepartureTuple }>, 
    routes: Record<string, GtfsRoute>, 
    rtVehicles: AppVehicleCollection | null
): AppDeparture[] {
    const now = Date.now();
    
    const filtered = deps.filter(d => {
        const ts = d.tuple[3];
        return ts >= now - GTFS_CONFIG.DEPARTURES_PAST_WINDOW_MS && ts <= now + GTFS_CONFIG.DEPARTURES_FUTURE_WINDOW_MS;
    });

    const tripIndex = indexVehiclesByTrip(rtVehicles);

    const sortableDeps = filtered.map(d => {
        const [trip_id, , , timestamp_ms] = d.tuple;
        let delaySecs: number | null = null;
        if (rtVehicles) {
            const rtProps = tripIndex.get(trip_id);
            if (rtProps && typeof rtProps.delay === 'number') {
                delaySecs = rtProps.delay;
            }
        }
        const rtTimestampMs = timestamp_ms + ((delaySecs || 0) * 1000);
        return { d, rtTimestampMs, delaySecs };
    });

    const topDeps = sortableDeps
        // Recently past departures are still sent: the app's live delay may show them as still to come.
        .filter(item => item.rtTimestampMs >= now - GTFS_CONFIG.DEPARTURES_RESURRECT_WINDOW_MS)
        .sort((a, b) => a.rtTimestampMs - b.rtTimestampMs)
        .slice(0, 150);

    return topDeps.map(item => {
        const { d, rtTimestampMs, delaySecs } = item;
        const { stopId, tuple } = d;
        const [trip_id, route_id, headsign, timestamp_ms, wheelchair_accessible, is_request_stop_num, extras] = tuple;
        const route = routes[route_id];
        
        let vId: string | undefined = undefined;
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
                if (rtProps.vehicle_descriptor?.is_air_conditioned !== undefined) {
                    isAirConditioned = rtProps.vehicle_descriptor.is_air_conditioned;
                }
                if (rtProps.vehicle_descriptor?.is_wheelchair_accessible !== undefined) {
                    isWheelchairAccessible = rtProps.vehicle_descriptor.is_wheelchair_accessible;
                }
            }
        }

        return {
            tripId: trip_id,
            vehicleId: vId,
            line: route ? String(route.name) : route_id,
            type: normalizeRouteType(route ? route.type : 'unknown'), 
            directionId: '0', 
            headsign: headsign,
            scheduled: new Date(timestamp_ms).toISOString(),
            timestamp: new Date(rtTimestampMs).toISOString(),
            delay: delaySecs,
            isCanceled: false,
            stopId: stopId,
            is_air_conditioned: isAirConditioned,
            is_wheelchair_accessible: isWheelchairAccessible,
            is_request_stop: is_request_stop_num === 1,
            ...(extras?.feeders ? { connections: mapFeeders(extras.feeders, timestamp_ms, routes) } : {}),
            ...(extras?.continues ? { continues_as: mapContinuation(extras.continues, tripIndex) } : {})
        } as AppDeparture;
    });
}

/**
 * The trips a departure waits for, and how long it would already hold for each if the feeder
 * arrives exactly on schedule. The frontend adds the feeder's live delay to get the real hold -
 * this is pure scheduling arithmetic, no live lookup, so it costs nothing on a cold isolate.
 */
function mapFeeders(
    feeders: GtfsFeederTuple[],
    scheduledMs: number,
    routes: Record<string, GtfsRoute>
): AppDepartureFeeder[] {
    return feeders.map(([feederTripId, routeId, arrivalMs, minTransferS, maxWaitS]) => {
        const route = routes[routeId];
        return {
            line: route ? String(route.name) : routeId,
            type: normalizeRouteType(route ? route.type : 'unknown'),
            trip_id: feederTripId,
            base_hold_s: Math.round((arrivalMs + minTransferS * 1000 - scheduledMs) / 1000),
            max_wait_s: maxWaitS,
        };
    });
}
