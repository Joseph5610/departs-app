import type { AppVehicleDetail } from "../../../../_core/types";
import type { transit_realtime } from "gtfs-realtime-bindings";
import { isNightRoute } from '../../../golemio/services/vehicles/colors';
import { toSecs, crossFix, haversineDist } from '../../core/utils';
import type { GtfsRoute } from '../../core/gtfs-data';
import type { Station } from './types';

export class VehicleDetailMapper {

    static mapVehicleDetail(
        tripId: string,
        vehicleId: string | null,
        currentVehicleData: transit_realtime.IVehiclePosition | null,
        stations: Station[],
        route: GtfsRoute | null
    ): AppVehicleDetail {
        const lineName = route?.name || '?';
        const routeColor = route?.route_color || '#888888';
        const rType = route ? Number(route.type) : 3;

        const feedTotalSecs = this.getFeedTotalSecs(currentVehicleData);
        const nowSecs = this.getNowSecs();

        const { lastStopSequence, computedDelay } = this.calculateDelayAndSequence(
            currentVehicleData, 
            stations, 
            feedTotalSecs, 
            nowSecs
        );

        const statePosition = (lastStopSequence === null || (lastStopSequence === 1 && computedDelay < -60)) 
            ? 'before_track' 
            : (currentVehicleData?.currentStatus === 1 ? 'at_stop' : 'running');

        const finalDelay = statePosition === 'before_track' ? 0 : computedDelay;

        const stopFeatures = this.buildStopFeatures(stations, lastStopSequence, finalDelay);
        const routeGeoJson = this.buildRouteGeoJson(stations, routeColor);
        
        const headsign = stations.length > 0 ? stations[stations.length - 1].name : 'Unknown destination';

        return {
            vehicle_id: currentVehicleData?.vehicle?.licensePlate || currentVehicleData?.vehicle?.id || vehicleId,
            gtfs_trip_id: tripId,
            route_short_name: lineName,
            route_type: rType,
            trip_headsign: headsign,
            bearing: currentVehicleData?.position?.bearing || null,
            delay: finalDelay,
            route_color: routeColor,
            is_night: isNightRoute(lineName),
            is_static_fallback: !currentVehicleData,
            state_position: statePosition,
            origin_timestamp: currentVehicleData?.timestamp ? new Date(Number(currentVehicleData.timestamp) * 1000).toISOString() : undefined,
            vehicle_descriptor: {
                operator: 'IDS JMK',
                vehicle_registration_number: String(currentVehicleData?.vehicle?.label || currentVehicleData?.vehicle?.id || '')
            },
            last_stop_sequence: lastStopSequence,
            route_geojson: routeGeoJson,
            stop_times: {
                features: stopFeatures
            }
        };
    }

    static getFeedTotalSecs(currentVehicleData: transit_realtime.IVehiclePosition | null): number {
        if (!currentVehicleData?.timestamp) return 0;
        
        const feedTime = new Date(Number(currentVehicleData.timestamp) * 1000);
        const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Prague', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false });
        const parts = formatter.formatToParts(feedTime);
        const fHour = Number(parts.find((p: unknown) => (p as Record<string, unknown>).type === 'hour')?.value) || 0;
        const fMin = Number(parts.find((p: unknown) => (p as Record<string, unknown>).type === 'minute')?.value) || 0;
        const fSec = Number(parts.find((p: unknown) => (p as Record<string, unknown>).type === 'second')?.value) || 0;
        return (fHour % 24) * 3600 + fMin * 60 + fSec;
    }

    static getNowSecs(): number {
        const nowFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Prague', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false });
        const nowParts = nowFormatter.formatToParts(new Date());
        return (Number(nowParts.find((p: Intl.DateTimeFormatPart) => p.type === 'hour')?.value) % 24) * 3600
            + Number(nowParts.find((p: Intl.DateTimeFormatPart) => p.type === 'minute')?.value) * 60
            + Number(nowParts.find((p: Intl.DateTimeFormatPart) => p.type === 'second')?.value);
    }

    static resolveCurrentSequence(currentVehicleData: transit_realtime.IVehiclePosition, stations: Station[]): number | null {
        if (currentVehicleData.stopId) {
            const normalizedStopId = currentVehicleData.stopId.replace(/([a-zA-Z])0+(?=\d)/g, '$1');
            
            const matchingIndices = stations.map((s, idx) => 
                s.id === normalizedStopId ? idx : -1
            ).filter(idx => idx !== -1);
            
            if (matchingIndices.length === 1) {
                return matchingIndices[0] + 1;
            } else if (matchingIndices.length > 1) {
                if (currentVehicleData.position) {
                    let closestIdx = matchingIndices[0];
                    let minD = Infinity;
                    const latC = currentVehicleData.position.latitude;
                    const lonC = currentVehicleData.position.longitude;
                    
                    for (const idx of matchingIndices) {
                        const [lon, lat] = stations[idx].coordinates;
                        const d = haversineDist(latC, lonC, lat, lon);
                        if (d < minD) {
                            minD = d;
                            closestIdx = idx;
                        }
                    }
                    return closestIdx + 1;
                }
                return matchingIndices[0] + 1;
            }
        } 
        
        if (currentVehicleData.currentStopSequence) {
            return currentVehicleData.currentStopSequence;
        }

        // Ultimate fallback: snap to closest stop by distance if we have position
        if (currentVehicleData.position) {
            let closestIdx = -1;
            let minD = Infinity;
            const latC = currentVehicleData.position.latitude;
            const lonC = currentVehicleData.position.longitude;
            for (let i = 0; i < stations.length; i++) {
                const [lon, lat] = stations[i].coordinates;
                const d = haversineDist(latC, lonC, lat, lon);
                if (d < minD) {
                    minD = d;
                    closestIdx = i;
                }
            }
            if (closestIdx !== -1 && minD < 1000) {
                return closestIdx + 1;
            }
        }
        
        return null;
    }

    private static calculateStoppedDelay(
        currentVehicleData: transit_realtime.IVehiclePosition, 
        stations: Station[], 
        passedIndex: number, 
        feedTotalSecs: number
    ): number {
        if (!feedTotalSecs || passedIndex < 0 || passedIndex >= stations.length) return 0;
        const arrTimeField = stations[passedIndex].arrival_time || stations[passedIndex].departure_time;
        if (!arrTimeField) return 0;
        
        const schedSecs = crossFix(toSecs(String(arrTimeField)), feedTotalSecs);
        let delay = feedTotalSecs - schedSecs;
        
        if (passedIndex === 0 && delay < 0) {
            delay = 0;
        }
        return delay;
    }

    private static calculateRunningDelay(
        currentVehicleData: transit_realtime.IVehiclePosition, 
        stations: Station[], 
        passedIndex: number, 
        feedTotalSecs: number
    ): number {
        if (!feedTotalSecs || passedIndex < 0 || passedIndex >= stations.length - 1 || !currentVehicleData.position) return 0;
        
        const nextStop = stations[passedIndex + 1];
        const prevStop = stations[passedIndex];
        const arrTimeField = nextStop.arrival_time || nextStop.departure_time;
        const depTimeField = prevStop.departure_time || prevStop.arrival_time;
        
        if (!arrTimeField || !depTimeField) return 0;

        const arrSecs = crossFix(toSecs(String(arrTimeField)), feedTotalSecs);
        const depSecs = crossFix(toSecs(String(depTimeField)), feedTotalSecs);
        
        const [lon1, lat1] = prevStop.coordinates;
        const [lon2, lat2] = nextStop.coordinates;
        const lonC = currentVehicleData.position.longitude;
        const latC = currentVehicleData.position.latitude;
        
        const totalDist = haversineDist(lat1, lon1, lat2, lon2);
        const coveredDist = haversineDist(lat1, lon1, latC, lonC);
        
        let fraction = totalDist > 0 ? coveredDist / totalDist : 0;
        fraction = Math.min(Math.max(fraction, 0), 1);
        
        const expectedSecs = depSecs + fraction * (arrSecs - depSecs);
        return Math.floor(feedTotalSecs - expectedSecs);
    }

    /**
     * Calculates the real-time delay of a vehicle by comparing its current position/status
     * against the scheduled arrival/departure times of its trip.
     * 
     * - If the vehicle is AT a stop, the delay is based directly on that stop's scheduled time.
     * - If the vehicle is IN TRANSIT between stops, the delay is interpolated using the 
     *   haversine distance covered between the previous and next stops.
     * 
     * Delay is clamped to a maximum bounds of [-1800, 7200] seconds, and any sub-60s delay is treated as 0.
     * 
     * @param currentVehicleData The real-time position update from GTFS-RT
     * @param stations The scheduled stops for the vehicle's trip
     * @param feedTotalSecs The absolute timestamp of the vehicle's last position update in seconds
     * @param nowSecs The current system time in seconds
     * @returns The last passed sequence number and the computed delay in seconds.
     */
    static calculateDelayAndSequence(
        currentVehicleData: transit_realtime.IVehiclePosition | null, 
        stations: Station[], 
        feedTotalSecs: number, 
        nowSecs: number
    ): { lastStopSequence: number | null, computedDelay: number } {
        let lastStopSequence: number | null = null;
        let computedDelay = 0;

        if (currentVehicleData) {
            const currentSeq = this.resolveCurrentSequence(currentVehicleData, stations);

            if (currentSeq !== null) {
                const isStopped = currentVehicleData.currentStatus === 1;
                lastStopSequence = isStopped ? currentSeq : (currentSeq > 1 ? currentSeq - 1 : null);
                
                const passedIndex = lastStopSequence !== null ? lastStopSequence - 1 : -1;
                
                if (isStopped) {
                    computedDelay = this.calculateStoppedDelay(currentVehicleData, stations, passedIndex, feedTotalSecs);
                } else {
                    computedDelay = this.calculateRunningDelay(currentVehicleData, stations, passedIndex, feedTotalSecs);
                }
            }
        }

        if (Math.abs(computedDelay) < 60) {
            computedDelay = 0;
        }
        computedDelay = Math.max(-1800, Math.min(computedDelay, 7200));

        if (lastStopSequence === null) {
            let lastPassedIndex = -1;
            const effectiveNowSecs = feedTotalSecs || nowSecs;
            for (let i = 0; i < stations.length; i++) {
                const stopSecs = toSecs(String(stations[i].arrival_time));
                if (crossFix(stopSecs, effectiveNowSecs) < effectiveNowSecs) lastPassedIndex = i;
            }
            if (lastPassedIndex !== -1) {
                lastStopSequence = lastPassedIndex + 1;
                const arrTime = stations[lastPassedIndex].arrival_time || stations[lastPassedIndex].departure_time;
                if (arrTime) {
                    const schedSecs = crossFix(toSecs(String(arrTime)), effectiveNowSecs);
                    computedDelay = effectiveNowSecs - schedSecs;
                }
            }
        }

        return { lastStopSequence, computedDelay };
    }

    static buildStopFeatures(stations: Station[], lastStopSequence: number | null, computedDelay: number) {
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

        const addDelay = (timeStr: string | undefined | null, delaySecs: number) => {
            if (!timeStr) return undefined;
            const SECONDS_IN_DAY = 86400;
            let secs = toSecs(String(timeStr)) + delaySecs;
            if (secs < 0) secs += SECONDS_IN_DAY;
            const h = Math.floor(secs / 3600) % 24;
            const m = Math.floor((secs % 3600) / 60);
            const sec = Math.floor(secs % 60);
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
        };

        return stations.map((s) => {
            const applyDelay = s.sequence >= (lastStopSequence || 0) ? computedDelay : 0;
            return {
                type: 'Feature' as const,
                properties: {
                    stop_id: String(s.id),
                    stop_name: s.name,
                    stop_sequence: s.sequence,
                    arrival_time: formatTime(s.arrival_time),
                    departure_time: formatTime(s.departure_time),
                    realtime_arrival_time: addDelay(s.arrival_time, applyDelay) || formatTime(s.arrival_time),
                    realtime_departure_time: addDelay(s.departure_time, applyDelay) || formatTime(s.departure_time),
                    metro_lines: []
                }
            };
        });
    }

    static buildRouteGeoJson(stations: Station[], routeColor: string) {
        const coordinates: [number, number][] = stations.map((st) => st.coordinates);
        
        if (coordinates.length > 1) {
            return {
                type: 'FeatureCollection' as const,
                features: [{
                    type: 'Feature' as const,
                    geometry: {
                        type: 'LineString' as const,
                        coordinates
                    },
                    properties: { route_color: routeColor }
                }]
            };
        }
        return undefined;
    }

    static buildErrorResponse(vehicleId: string | null, tripId: string, headsign: string): AppVehicleDetail {
        return {
            vehicle_id: vehicleId,
            gtfs_trip_id: tripId,
            route_short_name: '?',
            route_type: 3,
            trip_headsign: headsign,
            bearing: null,
            delay: 0,
            route_color: '#888888',
            is_night: false,
            is_static_fallback: true
        };
    }
}
