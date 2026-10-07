import type { AppVehicleDetail } from "../../../_core/types";
import type { GtfsRoute } from '../../../_feeds/gtfs/gtfsData';
import type { Station } from '../../../_feeds/gtfs/types';
import { normalizeRouteType } from '../../../_core/utils/routeTypes';
import { isLocated } from '../../../_feeds/gtfs/tripStops';
import { toClockTime } from '../../../_core/utils/time';


export function mapVehicleDetail(
    tripId: string,
    vehicleId: string | null,
    stations: Station[],
    route: GtfsRoute | null
): AppVehicleDetail {
    const lineName = route?.name || undefined;
    const rType = normalizeRouteType(route ? route.type : '3');

    const stopFeatures = buildStopFeatures(stations);
    
    const headsign = stations.length > 0 ? stations[stations.length - 1].name : '';

    return {
        vehicle_id: vehicleId,
        gtfs_trip_id: tripId,
        route_short_name: lineName || '',
        route_type: rType,
        trip_headsign: headsign,
        bearing: null,
        delay: null,
        is_static_fallback: true,
        state_position: 'before_track',
        origin_timestamp: undefined,
        vehicle_descriptor: {
            operator: undefined,
            vehicle_registration_number: String(vehicleId || '')
        },
        last_stop_sequence: undefined,
        stop_times: {
            features: stopFeatures
        }
    };
}

function buildStopFeatures(stations: Station[]) {

    return stations.map((s) => {
        return {
            type: 'Feature' as const,
            ...(isLocated(s) ? { geometry: { type: 'Point', coordinates: s.coordinates } } : {}),
            properties: {
                stop_id: String(s.id),
                stop_name: s.name,
                stop_sequence: s.sequence,
                arrival_time: toClockTime(s.arrival_time),
                departure_time: toClockTime(s.departure_time),
                realtime_arrival_time: toClockTime(s.arrival_time),
                realtime_departure_time: toClockTime(s.departure_time),
                is_request_stop: s.is_request_stop,
                zone_id: s.zone_id ?? undefined
            }
        };
    });
}
