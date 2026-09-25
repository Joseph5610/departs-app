import type { AppContinuation, AppVehicleFeature } from '../../_core/types';

/** `[trip_id | null, route_id | null, line, headsign, departure_time | null]` */
export type GtfsContinuation = [string | null, string | null, string, string, string | null];

/**
 * The trip a vehicle continues as, with its live vehicle when running and `liveByTrip` is given.
 * `route_id` is sent raw - the frontend resolves name/type/color from the same routes.json join
 * vehicles/departures/alerts already use, so this never touches a route lookup.
 */
export function mapContinuation(
    [tripId, routeId, line, headsign, departureTime]: GtfsContinuation,
    liveByTrip?: Map<string, NonNullable<AppVehicleFeature['properties']>>
): AppContinuation {
    return {
        trip_id: tripId ?? undefined,
        vehicle_id: (tripId && liveByTrip?.get(tripId)?.vehicle_id) || undefined,
        route_id: routeId ?? undefined,
        line,
        headsign,
        departure_time: departureTime ?? undefined,
    };
}
