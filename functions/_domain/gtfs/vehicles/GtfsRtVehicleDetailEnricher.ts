import type { AppVehicleDetail, AppVehicleFeature, CityRequestContext } from "../../../_core/types";
import type { VehicleDetailEnricher } from "./VehicleDetailEnricher";
import type { VehiclesService } from "../../vehicles/VehiclesService";

import { addSecondsToTime, getLocalClock, toSecs, wrapDaySeconds } from '../../../_core/utils/time';
import { GTFS_CONFIG } from '../../../_feeds/gtfs/config';
import { isWaitingToStart } from '../../../_feeds/gtfs/schedule';
import { distanceToSegmentMeters } from '../../../_core/utils/geo';

const isPoint = (c: number[] | number[][] | undefined): c is number[] => !!c && typeof c[0] === 'number' && typeof c[1] === 'number';

/**
 * The standard GTFS-RT vehicle enricher.
 * It takes the static timetable and searches the GTFS-RT feed (via VehiclesService)
 * for the live position and delay of the vehicle. It then injects this live data
 * and recalculates all upcoming stop arrival/departure times.
 */
export class GtfsRtVehicleDetailEnricher implements VehicleDetailEnricher {
    constructor(protected vehiclesService: VehiclesService) {}

    async enrich(detail: AppVehicleDetail, _ctx: CityRequestContext): Promise<AppVehicleDetail> {
        return this.enrichLive(detail);
    }

    private async enrichLive(detail: AppVehicleDetail): Promise<AppVehicleDetail> {
        if (!detail.vehicle_id && !detail.gtfs_trip_id) {
            return detail;
        }

        const result = await this.vehiclesService.getSingleLiveVehicle(detail.vehicle_id || '', detail.gtfs_trip_id);
        const liveMatch = result.liveMatch;
        const lastStopId = result.lastStopId;
        if (result.registrationNumber) {
            detail.vehicle_descriptor = { ...detail.vehicle_descriptor, vehicle_registration_number: result.registrationNumber };
        }

        if (liveMatch) {
            // Matched by vehicle id, the vehicle may already run its next trip; this one then counts as ended.
            const liveTripId = liveMatch.properties.gtfs_trip_id;
            if (detail.gtfs_trip_id && liveTripId && liveTripId !== detail.gtfs_trip_id) {
                detail.is_static_fallback = true;
            } else {
                this.enrichVehicleDetail(detail, liveMatch, lastStopId);
            }
        }

        return detail;
    }

    protected enrichVehicleDetail(detail: AppVehicleDetail, liveMatch: AppVehicleFeature, lastStopId?: string) {
        detail.vehicle_id = liveMatch.properties.vehicle_id || detail.vehicle_id;
        detail.delay = liveMatch.properties.delay;
        detail.state_position = liveMatch.properties.state_position;
        detail.bearing = liveMatch.properties.bearing;
        detail.origin_timestamp = liveMatch.properties.origin_timestamp;
        detail.run_number = liveMatch.properties.run_number;
        
        if (liveMatch.geometry) {
            detail.geometry = liveMatch.geometry;
        }
        
        if (liveMatch.properties.vehicle_descriptor) {
            detail.vehicle_descriptor = {
                ...detail.vehicle_descriptor,
                ...liveMatch.properties.vehicle_descriptor,
                vehicle_registration_number: liveMatch.properties.vehicle_descriptor.vehicle_registration_number || detail.vehicle_id || undefined,
                is_wheelchair_accessible: liveMatch.properties.vehicle_descriptor.is_wheelchair_accessible ?? detail.vehicle_descriptor?.is_wheelchair_accessible
            };
        }

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
        
        detail.last_stop_sequence = resolvedSequence
            ?? liveMatch.properties.last_stop_sequence
            ?? this.sequenceFromPosition(detail.stop_times?.features, liveMatch.geometry?.coordinates)
            ?? undefined;

        // Must run before the delay is estimated: a vehicle still at its origin has none, and estimateLocalDelay() relies on this state.
        this.evaluateBeforeTrack(detail);

        if (detail.delay == null) {
            const estimatedDelay = this.estimateLocalDelay(detail);
            if (estimatedDelay !== null) {
                detail.delay = estimatedDelay;
            }
        }

        const delay = detail.delay;
        if (typeof delay === 'number' && detail.stop_times?.features) {
            detail.stop_times.features.forEach(f => {
                if (f.properties.stop_sequence >= (detail.last_stop_sequence || 0)) {
                    f.properties.realtime_arrival_time = addSecondsToTime(f.properties.arrival_time, delay) || f.properties.arrival_time;
                    f.properties.realtime_departure_time = addSecondsToTime(f.properties.departure_time, delay) || f.properties.departure_time;
                }
            });
        }

        detail.is_static_fallback = false;
    }

    protected evaluateBeforeTrack(detail: AppVehicleDetail) {
        if (detail.state_position === 'canceled') return;

        const firstStop = detail.stop_times?.features?.[0];
        if (!firstStop) return;

        // Deliberately the scheduled time: the realtime field is derived from the delay, which is
        // exactly what must not influence whether the vehicle has departed yet.
        const depTimeStr = firstStop.properties.departure_time;
        if (!depTimeStr) return;

        const minsToStart = wrapDaySeconds(toSecs(depTimeStr) - getLocalClock(this.vehiclesService.city.timezone).secs) / 60;
        if (isWaitingToStart(minsToStart, detail.last_stop_sequence)) {
            const delaySecs = detail.delay ?? 0;
            detail.state_position = delaySecs > GTFS_CONFIG.BEFORE_TRACK_DELAY_THRESHOLD_SECS ? 'before_track_delayed' : 'before_track';
        }
    }

    protected findMatchingStop(
        features: NonNullable<NonNullable<AppVehicleDetail['stop_times']>['features']>,
        lastStopId: string
    ) {
        return features.find(s => s.properties.stop_id === lastStopId);
    }

    /**
     * The stop a vehicle last left, read off the trip segment nearest its position. For feeds that
     * report a stop outside the trip (KORDIS trains name railway points with no GTFS stop).
     */
    protected sequenceFromPosition(
        features: NonNullable<AppVehicleDetail['stop_times']>['features'] | undefined,
        position: number[] | undefined
    ): number | null {
        if (!features || features.length < 2 || !position) return null;
        const [lon, lat] = position;
        let best: number | null = null;
        let bestDist = Infinity;
        for (let i = 0; i < features.length - 1; i++) {
            const a = features[i].geometry?.coordinates;
            const b = features[i + 1].geometry?.coordinates;
            if (!isPoint(a) || !isPoint(b)) continue;
            const dist = distanceToSegmentMeters(lat, lon, a[1], a[0], b[1], b[0]);
            if (dist < bestDist) {
                bestDist = dist;
                best = features[i].properties.stop_sequence;
            }
        }
        return best;
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
        
        const currentTargetStopIndex = detail.stop_times.features.findIndex(f => f.properties.stop_sequence === currentSeq);
        if (currentTargetStopIndex === -1) return null;
        
        const targetStop = detail.stop_times.features[currentTargetStopIndex];

        const realMs = Date.parse(detail.origin_timestamp);
        if (Number.isNaN(realMs)) return null;
        const realSecs = getLocalClock(this.vehiclesService.city.timezone, realMs).secs;

        if (detail.state_position === 'at_stop') {
            const targetTimeStr = targetStop.properties.arrival_time;
            if (!targetTimeStr) return null;
            const targetSecs = toSecs(targetTimeStr);
            return this.calculateDelaySeconds(realSecs, targetSecs, detail.state_position);
        }

        // Between stops, the delay is bounded by the departure from the stop just left (A) and the arrival at the next (B).
        const timeAStr = targetStop.properties.departure_time || targetStop.properties.arrival_time;
        if (!timeAStr) return null;
        const delayA = this.calculateDelaySeconds(realSecs, toSecs(timeAStr)); // Delay relative to leaving Stop A

        const nextTargetStop = detail.stop_times.features[currentTargetStopIndex + 1];
        if (nextTargetStop) {
            const timeBStr = nextTargetStop.properties.arrival_time || nextTargetStop.properties.departure_time;
            if (timeBStr) {
                const delayB = this.calculateDelaySeconds(realSecs, toSecs(timeBStr)); // Delay relative to arriving at Stop B
                if (delayA > 0 && delayB < 0) return 0; // Assume perfectly on time
                if (delayB >= 0) return delayB;
                if (delayA <= 0) return delayA;
            }
        }

        return delayA > 0 ? 0 : delayA;
    }

    /**
     * Calculates the delay in seconds given real and scheduled times in seconds since midnight.
     * Handles 24h/12h wrap-around boundaries and caps negative delays for vehicles already at a stop.
     */
    protected calculateDelaySeconds(realSecs: number, targetSecs: number, statePosition?: string): number {
        const delaySecs = wrapDaySeconds(realSecs - targetSecs);

        // Cap negative delay if stopped early, because the vehicle will wait for its scheduled departure
        if (statePosition === 'at_stop' && delaySecs < 0) {
            return 0;
        }

        return delaySecs;
    }

}
