import type { AppVehicleDetail } from '../../_core/types';

export type ObservedDetail = Pick<AppVehicleDetail, 'is_static_fallback' | 'state_position' | 'last_stop_sequence' | 'stop_times' | 'delay'>;

/**
 * What one read of a trip says, decided once so no rule can mistake one case for another:
 * `failed`: the read failed and says nothing; `cancelled`: the feed cancelled the trip; `timetable`: no realtime at all,
 * only the clock on the timetable tells; `realtime`: the trip's delay, and the stop it last passed (null before it starts).
 */
export type TripObservation =
    | { kind: 'failed' }
    | { kind: 'cancelled' }
    | { kind: 'timetable' }
    | { kind: 'realtime'; detail: ObservedDetail; current: number | null };

const NOT_STARTED = new Set(['before_track', 'before_track_delayed']);

export const observe = (detail: ObservedDetail | null): TripObservation => {
    if (!detail) return { kind: 'failed' };
    if (detail.state_position === 'canceled') return { kind: 'cancelled' };
    if (detail.is_static_fallback) return { kind: 'timetable' };
    const seq = detail.last_stop_sequence;
    const current = NOT_STARTED.has(detail.state_position ?? '') || seq === null || seq === undefined ? null : Number(seq);
    return { kind: 'realtime', detail, current };
};

/** The stop the live vehicle last passed; null without a live position. */
export const currentStop = (observation: TripObservation): number | null => (observation.kind === 'realtime' ? observation.current : null);

/**
 * Whether the vehicle has left the stop at `sequence`: it passed it, or reported it and isn't standing there any more.
 * Null without a live position (the app's `hasLeftStop`).
 */
export const hasLeftStop = (observation: TripObservation, sequence: number): boolean | null => {
    if (observation.kind !== 'realtime' || observation.current === null) return null;
    return observation.current > sequence || (observation.current === sequence && observation.detail.state_position !== 'at_stop');
};
