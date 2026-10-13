import { RIDE_PUSH } from '../../_core/config';
import type { AppVehicleDetail } from '../../_core/types';

/** `next`: the vehicle left the stop before the exit; `arrived`: it reached the exit or the trip's end. */
export type RideAlert = 'next' | 'arrived';

type RideDetail = Pick<AppVehicleDetail, 'is_static_fallback' | 'state_position' | 'last_stop_sequence' | 'stop_times'>;

const NOT_STARTED = new Set(['before_track', 'before_track_delayed']);

/** The stop the live vehicle last passed; null for a timetable-only trip or one that hasn't started (the app's `liveStopSequence`). */
export const liveStopSequence = (detail: RideDetail): number | null => {
    if (detail.is_static_fallback || NOT_STARTED.has(detail.state_position ?? '')) return null;
    const seq = detail.last_stop_sequence;
    return seq === null || seq === undefined ? null : Number(seq);
};

/** Stops after `current` up to and including the exit. */
export const stopsLeft = (detail: RideDetail, current: number, exitSequence: number): number => {
    let count = 0;
    for (const s of detail.stop_times?.features ?? []) {
        const seq = Number(s.properties.stop_sequence);
        if (seq > current && seq <= exitSequence) count++;
    }
    return count;
};

const lastSequence = (detail: RideDetail): number | null => {
    let last: number | null = null;
    for (const s of detail.stop_times?.features ?? []) last = Math.max(last ?? 0, Number(s.properties.stop_sequence));
    return last;
};

/** The alert a rider is due, once each: `arrived` wins over a `next` never sent. */
export const rideAlertFor = (detail: RideDetail, exitSequence: number, alerted: readonly RideAlert[]): RideAlert | null => {
    const current = liveStopSequence(detail);
    if (current === null) return null;
    const last = lastSequence(detail);
    const due: RideAlert | null = current >= exitSequence || (last !== null && current >= last) ? 'arrived'
        : stopsLeft(detail, current, exitSequence) === 1 ? 'next'
        : null;
    return due && !alerted.includes(due) ? due : null;
};

/** Whether a rider is close enough to their exit for the short alarm interval. */
export const isNearExit = (detail: RideDetail, exitSequence: number): boolean => {
    const current = liveStopSequence(detail);
    return current !== null && stopsLeft(detail, current, exitSequence) <= RIDE_PUSH.NEAR_STOPS;
};
