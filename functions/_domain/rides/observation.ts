import type { AppVehicleDetail } from '../../_core/types';
import { hasLeftStop as leftStop, liveStopSequence } from '../../../shared/rides';

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

export const observe = (detail: ObservedDetail | null): TripObservation => {
    if (!detail) return { kind: 'failed' };
    if (detail.state_position === 'canceled') return { kind: 'cancelled' };
    if (detail.is_static_fallback) return { kind: 'timetable' };
    return { kind: 'realtime', detail, current: liveStopSequence(detail) };
};

/** The stop the live vehicle last passed; null without a live position. */
export const currentStop = (observation: TripObservation): number | null => (observation.kind === 'realtime' ? observation.current : null);

/** The live detail, for the shared rules; null without realtime. */
export const liveDetail = (observation: TripObservation): ObservedDetail | null => (observation.kind === 'realtime' ? observation.detail : null);

/** Whether the vehicle has left the stop at `sequence`; null without a live position. */
export const hasLeftStop = (observation: TripObservation, sequence: number): boolean | null => leftStop(liveDetail(observation), sequence);
