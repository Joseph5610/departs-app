import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppVehicleDetail, AppVehicleFeature } from "../../../../_core/types";
import type { VehicleDetailEnricher } from "./VehicleDetailEnricher";
import type { VehiclesService } from "./VehiclesService";

import { addSecondsToTime, getMinutesUntil, getLocalSecondsFromISO, toSecs } from '../../core/utils';
import { GTFS_CONFIG } from '../../core/config';

/**
 * The standard GTFS-RT vehicle enricher.
 * It takes the static timetable and searches the GTFS-RT feed (via VehiclesService)
 * for the live position and delay of the vehicle. It then injects this live data
 * and recalculates all upcoming stop arrival/departure times.
 */
export class GtfsRtVehicleDetailEnricher implements VehicleDetailEnricher {
    constructor(protected vehiclesService: VehiclesService) {}

    async enrich(detail: AppVehicleDetail, _ctx: EventContext<Env, string, unknown>): Promise<AppVehicleDetail> {
        if (!detail.vehicle_id && !detail.gtfs_trip_id) {
            return detail;
        }

        const result = await this.vehiclesService.getSingleLiveVehicle(detail.vehicle_id || '', detail.gtfs_trip_id);
        const liveMatch = result.liveMatch;
        const lastStopId = result.lastStopId;

        if (liveMatch) {
            this.enrichVehicleDetail(detail, liveMatch, lastStopId);
        }

        return detail;
    }

    protected enrichVehicleDetail(detail: AppVehicleDetail, liveMatch: AppVehicleFeature, lastStopId?: string) {
        // 1. Transfer Core Live Properties
        detail.vehicle_id = liveMatch.properties.vehicle_id || detail.vehicle_id;
        detail.delay = liveMatch.properties.delay;
        detail.state_position = liveMatch.properties.state_position;
        detail.bearing = liveMatch.properties.bearing;
        detail.origin_timestamp = liveMatch.properties.origin_timestamp;
        detail.run_number = liveMatch.properties.run_number;
        
        if (liveMatch.geometry) {
            detail.geometry = liveMatch.geometry;
        }
        
        // 2. Transfer Descriptor
        if (liveMatch.properties.vehicle_descriptor) {
            detail.vehicle_descriptor = {
                ...detail.vehicle_descriptor,
                ...liveMatch.properties.vehicle_descriptor,
                vehicle_registration_number: liveMatch.properties.vehicle_descriptor.vehicle_registration_number || detail.vehicle_id || undefined,
                is_wheelchair_accessible: liveMatch.properties.vehicle_descriptor.is_wheelchair_accessible ?? detail.vehicle_descriptor?.is_wheelchair_accessible
            };
        }

        // 3. Resolve Last Stop Sequence (Base generic implementation)
        let resolvedSequence: number | null = null;
        if (lastStopId && detail.stop_times?.features) {
            const stopMatch = this.findMatchingStop(detail.stop_times.features, lastStopId);
            
            if (stopMatch) {
                let seq = stopMatch.properties.stop_sequence;
                if (detail.state_position === 'on_track') {
                    seq = Math.max(1, seq - 1);
                }
                resolvedSequence = seq;
            }
        }
        
        detail.last_stop_sequence = resolvedSequence ?? liveMatch.properties.last_stop_sequence ?? undefined;

        // 3.5. Estimate Delay if missing
        if (detail.delay == null) {
            const estimatedDelay = this.estimateLocalDelay(detail);
            if (estimatedDelay !== null) {
                detail.delay = estimatedDelay;
            }
        }

        // 4. Propagate Delays to Subsequent Stops
        const delay = detail.delay;
        if (typeof delay === 'number' && detail.stop_times?.features) {
            detail.stop_times.features.forEach(f => {
                if (f.properties.stop_sequence >= (detail.last_stop_sequence || 0)) {
                    f.properties.realtime_arrival_time = addSecondsToTime(f.properties.arrival_time, delay) || f.properties.arrival_time;
                    f.properties.realtime_departure_time = addSecondsToTime(f.properties.departure_time, delay) || f.properties.departure_time;
                }
            });
        }

        // 5. Evaluate Before-Track Status directly from first stop schedule
        this.evaluateBeforeTrack(detail);

        detail.is_static_fallback = false;
    }

    protected evaluateBeforeTrack(detail: AppVehicleDetail) {
        if (detail.state_position === 'canceled') return;

        const firstStop = detail.stop_times?.features?.[0];
        if (!firstStop) return;

        const seq = detail.last_stop_sequence;
        // If the vehicle has already proceeded past stop 1, it is no longer before track
        if (seq !== undefined && seq !== null && seq > 1) {
            return;
        }

        const depTimeStr = firstStop.properties.realtime_departure_time || firstStop.properties.departure_time;
        if (!depTimeStr) return;

        const diffMins = getMinutesUntil(depTimeStr, this.vehiclesService.city.timezone);

        // If departure is in the future (within window) and vehicle is at origin terminal
        if (diffMins > 0 && diffMins <= GTFS_CONFIG.BEFORE_TRACK_WINDOW_MINS) {
            const delaySecs = detail.delay ?? 0;
            detail.state_position = delaySecs > GTFS_CONFIG.BEFORE_TRACK_DELAY_THRESHOLD_SECS ? 'before_track_delayed' : 'before_track';
        }
    }

    protected findMatchingStop(
        features: NonNullable<NonNullable<AppVehicleDetail['stop_times']>['features']>,
        lastStopId: string
    ) {
        const normalizedTarget = this.normalizeStopId(lastStopId);

        // 1. Direct or clean ID match
        const match = features.find(s => {
            const sid = s.properties.stop_id;
            if (!sid) return false;
            return (
                sid === lastStopId ||
                sid === normalizedTarget ||
                this.normalizeStopId(sid) === normalizedTarget
            );
        });

        return match;
    }

    /**
     * Estimates the local delay by comparing the vehicle's real-time GPS timestamp
     * against the static scheduled time for its current position.
     * 
     * @param detail The vehicle detail containing static stop times and live state.
     * @returns The estimated delay in seconds, or null if it cannot be calculated.
     */
    protected estimateLocalDelay(detail: AppVehicleDetail): number | null {
        if (!detail.origin_timestamp || !detail.stop_times?.features || detail.last_stop_sequence == null) {
            return null;
        }

        if (detail.state_position && detail.state_position.startsWith('before_track')) {
            return null;
        }

        const currentSeq = detail.last_stop_sequence;
        
        // Find the relevant stop in the static schedule
        const currentTargetStopIndex = detail.stop_times.features.findIndex(f => f.properties.stop_sequence === currentSeq);
        if (currentTargetStopIndex === -1) return null;
        
        const targetStop = detail.stop_times.features[currentTargetStopIndex];

        const realSecs = getLocalSecondsFromISO(detail.origin_timestamp, this.vehiclesService.city.timezone);
        if (realSecs === null) return null;

        if (detail.state_position === 'at_stop') {
            const targetTimeStr = targetStop.properties.arrival_time;
            if (!targetTimeStr) return null;
            const targetSecs = toSecs(targetTimeStr);
            return this.calculateDelaySeconds(realSecs, targetSecs, detail.state_position);
        }

        // --- on_track logic (Time Bounding Box) ---
        // For vehicles between stops, we establish a window based on the departure of the stop it just left (Stop A)
        // and the arrival of the next stop it is approaching (Stop B).
        const timeAStr = targetStop.properties.departure_time || targetStop.properties.arrival_time;
        if (!timeAStr) return null;
        const delayA = this.calculateDelaySeconds(realSecs, toSecs(timeAStr)); // Delay relative to leaving Stop A

        const nextTargetStop = detail.stop_times.features[currentTargetStopIndex + 1];
        if (nextTargetStop) {
            const timeBStr = nextTargetStop.properties.arrival_time || nextTargetStop.properties.departure_time;
            if (timeBStr) {
                const delayB = this.calculateDelaySeconds(realSecs, toSecs(timeBStr)); // Delay relative to arriving at Stop B

                // If real time is between Stop A departure and Stop B arrival, the bus is within its scheduled transit window.
                if (delayA > 0 && delayB < 0) return 0; // Assume perfectly on time
                
                // If real time is past Stop B arrival, it is definitively late. We return the conservative lower bound.
                if (delayB >= 0) return delayB;

                // If real time is before Stop A departure, it is definitively early. We return the conservative lower bound.
                if (delayA <= 0) return delayA;
            }
        }

        // Fallback if there is no Stop B (e.g. end of line)
        return delayA > 0 ? 0 : delayA;
    }

    /**
     * Calculates the delay in seconds given real and scheduled times in seconds since midnight.
     * Handles 24h/12h wrap-around boundaries and caps negative delays for vehicles already at a stop.
     */
    protected calculateDelaySeconds(realSecs: number, targetSecs: number, statePosition?: string): number {
        let delaySecs = realSecs - targetSecs;
        
        // Handle midnight boundaries (e.g. 23:59 vs 00:01)
        if (delaySecs < -43200) delaySecs += 86400; // -12h wrap
        if (delaySecs > 43200) delaySecs -= 86400;  // +12h wrap

        // Cap negative delay if stopped early, because the vehicle will wait for its scheduled departure
        if (statePosition === 'at_stop' && delaySecs < 0) {
            return 0;
        }

        return delaySecs;
    }

    /**
     * Override this method in city-specific enrichers to handle stop ID normalization.
     */
    protected normalizeStopId(stopId: string): string {
        return stopId;
    }
}
