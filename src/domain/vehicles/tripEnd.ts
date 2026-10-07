import { TRIP_CONFIG } from '@/config/constants';
import { secondsOfDayIn, timeToSeconds, wrapDaySeconds } from '@/domain/time';
import type { StopTimeFeature, VehicleDetail } from '@/types';

/** The trip's last stop by sequence. */
export const lastStopOf = (stops: StopTimeFeature[]): StopTimeFeature | null => {
    let last: StopTimeFeature | null = null;
    for (const s of stops) if (!last || Number(s.properties.stop_sequence) > Number(last.properties.stop_sequence)) last = s;
    return last;
};

/**
 * Seconds since the trip reached its last stop (negative while it still runs), from that stop's realtime
 * or scheduled-plus-delay arrival in timetable time; null without stop times.
 */
export const secondsSinceTripEnd = (stops: StopTimeFeature[], delay: number | null | undefined, nowMs: number, timeZone: string): number | null => {
    const p = lastStopOf(stops)?.properties;
    if (!p) return null;
    const arrival = p.realtime_arrival_time
        ? timeToSeconds(p.realtime_arrival_time)
        : p.arrival_time ? timeToSeconds(p.arrival_time) + (typeof delay === 'number' ? delay : 0) : null;
    if (arrival === null) return null;
    return wrapDaySeconds(secondsOfDayIn(timeZone, nowMs) - arrival);
};

/**
 * Whether the trip is over: its live vehicle has reached the last stop, or the last stop is past by the grace period.
 * `lastPassedSequence` is the vehicle's last stop, null without a live vehicle.
 */
export const isTripEnded = (stops: StopTimeFeature[], delay: number | null | undefined, lastPassedSequence: number | null, nowMs: number, timeZone: string): boolean => {
    const last = lastStopOf(stops);
    if (!last) return false;
    if (lastPassedSequence !== null && lastPassedSequence >= Number(last.properties.stop_sequence)) return true;
    const sinceEnd = secondsSinceTripEnd(stops, delay, nowMs, timeZone);
    return sinceEnd !== null && sinceEnd > TRIP_CONFIG.ENDED_GRACE_S;
};

const NOT_STARTED = new Set(['before_track', 'before_track_delayed']);

/** The stop its live vehicle last passed; null for a timetable-only trip or one that hasn't started. */
export const liveStopSequence = (detail: Pick<VehicleDetail, 'is_static_fallback' | 'state_position' | 'last_stop_sequence'> | null | undefined): number | null => {
    if (!detail || detail.is_static_fallback || NOT_STARTED.has(detail.state_position ?? '')) return null;
    const seq = detail.last_stop_sequence;
    return seq === null || seq === undefined ? null : Number(seq);
};
