import type { AppVehicleDetail } from "../../../../_core/types";
import type { GtfsRoute } from '../../core/gtfs-data';
import type { Station } from './types';
import { normalizeRouteType } from '../../../../_core/utils/routeTypes';
import { GTFS_CONFIG } from '../../core/config';
import { isLocated } from '../../core/trip-stops';
import { toClockTime } from '../../../../_core/utils/time';

export class VehicleDetailMapper {

    static mapVehicleDetail(
        tripId: string,
        vehicleId: string | null,
        stations: Station[],
        route: GtfsRoute | null,
        tripShape: [number, number][][] | null = null
    ): AppVehicleDetail {
        const lineName = route?.name || undefined;
        const routeColor = route?.route_color || undefined;
        const rType = normalizeRouteType(route ? route.type : '3');

        const stopFeatures = this.buildStopFeatures(stations);
        const routeGeoJson = this.buildRouteGeoJson(stations, routeColor || GTFS_CONFIG.DEFAULT_ROUTE_COLOR, tripShape);
        
        const headsign = stations.length > 0 ? stations[stations.length - 1].name : '';

        return {
            vehicle_id: vehicleId,
            gtfs_trip_id: tripId,
            route_short_name: lineName || '',
            route_type: rType,
            trip_headsign: headsign,
            bearing: null,
            delay: null,
            route_color: routeColor || GTFS_CONFIG.DEFAULT_ROUTE_COLOR,
            is_static_fallback: true,
            state_position: 'before_track',
            origin_timestamp: undefined,
            vehicle_descriptor: {
                operator: undefined,
                vehicle_registration_number: String(vehicleId || '')
            },
            last_stop_sequence: undefined,
            route_geojson: routeGeoJson,
            stop_times: {
                features: stopFeatures
            }
        };
    }

    static buildStopFeatures(stations: Station[]) {

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

    static buildRouteGeoJson(allStations: Station[], routeColor: string, tripShape: [number, number][][] | null = null) {
        const stations = allStations.filter(isLocated);
        // If a real GTFS shape is available, flatten multi-line segments into a single coordinate array.
        // Otherwise, fall back to straight station-to-station lines.
        const coordinates: [number, number][] = tripShape
            ? tripShape.flat()
            : stations.map((st) => st.coordinates);
        
        if (coordinates.length > 1) {
            const lineFeature = {
                type: 'Feature' as const,
                geometry: {
                    type: 'LineString' as const,
                    coordinates
                },
                properties: { route_color: routeColor }
            };

            // Add Point features for each stop so routeStopsLayer and routeTerminalsLayer render
            // correctly on the map (matching Prague/Golemio behaviour).
            const stopFeatures = stations.map((st, index) => {
                const isTerminal = index === 0 || index === stations.length - 1;
                return {
                    type: 'Feature' as const,
                    geometry: {
                        type: 'Point' as const,
                        coordinates: st.coordinates
                    },
                    properties: {
                        route_color: routeColor,
                        is_terminal: isTerminal
                    }
                };
            });

            return {
                type: 'FeatureCollection' as const,
                features: [lineFeature, ...stopFeatures]
            };
        }
        return undefined;
    }


}
