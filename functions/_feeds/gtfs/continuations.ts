import type { AppContinuation, AppVehicleFeature } from '../../_core/types';
import type { GtfsRoute } from './gtfs-data';
import { normalizeRouteType } from '../../_core/utils/routeTypes';

/** `[trip_id | null, route_id | null, line, headsign, departure_time | null]` */
export type GtfsContinuation = [string | null, string | null, string, string, string | null];

/** Resolves the trip a vehicle continues as, with its live vehicle when running and `liveByTrip` is given. */
export function mapContinuation(
    [tripId, routeId, line, headsign, departureTime]: GtfsContinuation,
    routes: Record<string, GtfsRoute>,
    liveByTrip?: Map<string, NonNullable<AppVehicleFeature['properties']>>
): AppContinuation {
    const route = routeId ? routes[routeId] : undefined;
    return {
        trip_id: tripId ?? undefined,
        vehicle_id: (tripId && liveByTrip?.get(tripId)?.vehicle_id) || undefined,
        line: route ? String(route.name) : line,
        route_color: route?.route_color ?? undefined,
        type: normalizeRouteType(route ? route.type : 'unknown'),
        headsign,
        departure_time: departureTime ?? undefined,
    };
}
