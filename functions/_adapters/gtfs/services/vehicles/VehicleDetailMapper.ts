import type { AppVehicleDetail } from "../../../../_core/types";
import { addSecondsToTime } from '../../core/utils';
import type { GtfsRoute } from '../../core/gtfs-data';
import type { Station } from './types';

export class VehicleDetailMapper {

    static mapVehicleDetail(
        tripId: string,
        vehicleId: string | null,
        stations: Station[],
        route: GtfsRoute | null
    ): AppVehicleDetail {
        const lineName = route?.name || undefined;
        const routeColor = route?.route_color || undefined;
        const rType = route ? Number(route.type) : 3;

        const finalDelay = null;
        const lastStopSequence = null;

        const stopFeatures = this.buildStopFeatures(stations, lastStopSequence, finalDelay);
        const routeGeoJson = this.buildRouteGeoJson(stations, routeColor || '#888888');
        
        const headsign = stations.length > 0 ? stations[stations.length - 1].name : '';

        return {
            vehicle_id: vehicleId,
            gtfs_trip_id: tripId,
            route_short_name: lineName || '',
            route_type: rType,
            trip_headsign: headsign,
            bearing: null,
            delay: finalDelay,
            route_color: routeColor || '',
            is_night: false,
            is_static_fallback: true,
            state_position: 'before_track',
            origin_timestamp: undefined,
            vehicle_descriptor: {
                operator: undefined,
                vehicle_registration_number: String(vehicleId || '')
            },
            last_stop_sequence: lastStopSequence,
            route_geojson: routeGeoJson,
            stop_times: {
                features: stopFeatures
            }
        };
    }

    static buildStopFeatures(stations: Station[], lastStopSequence: number | null, computedDelay: number | null) {
        const formatTime = (timeStr: string | undefined | null): string => {
            if (!timeStr) return '';
            const parts = String(timeStr).split(':');
            if (parts.length >= 2) {
                let h = parseInt(parts[0], 10);
                if (h >= 24) h = h % 24;
                parts[0] = String(h).padStart(2, '0');
                return parts.join(':');
            }
            return String(timeStr);
        };

        return stations.map((s) => {
            const applyDelay = s.sequence >= (lastStopSequence || 0) ? computedDelay : 0;
            return {
                type: 'Feature' as const,
                geometry: {
                    type: 'Point',
                    coordinates: s.coordinates
                },
                properties: {
                    stop_id: String(s.id),
                    stop_name: s.name,
                    stop_sequence: s.sequence,
                    arrival_time: formatTime(s.arrival_time),
                    departure_time: formatTime(s.departure_time),
                    realtime_arrival_time: (applyDelay ? addSecondsToTime(s.arrival_time, applyDelay) : undefined) || formatTime(s.arrival_time),
                    realtime_departure_time: (applyDelay ? addSecondsToTime(s.departure_time, applyDelay) : undefined) || formatTime(s.departure_time),
                    metro_lines: []
                }
            };
        });
    }

    static buildRouteGeoJson(stations: Station[], routeColor: string) {
        const coordinates: [number, number][] = stations.map((st) => st.coordinates);
        
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
                const isStart = index === 0;
                const isEnd = index === stations.length - 1;
                return {
                    type: 'Feature' as const,
                    geometry: {
                        type: 'Point' as const,
                        coordinates: st.coordinates
                    },
                    properties: {
                        stop_id: String(st.id),
                        stop_name: st.name,
                        route_color: routeColor,
                        is_start: isStart,
                        is_end: isEnd,
                        is_regular: !isStart && !isEnd
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
