import { RIDE_PUSH } from '../../_core/config';
import { stopsLeft as countStopsLeft } from '../../../shared/rides';
import { currentStop, type ObservedDetail, type TripObservation } from './observation';

/** `next`: the vehicle left the stop before the exit; `arrived`: it reached the exit or the trip's end. */
export type RideAlert = 'next' | 'arrived';

const stopsLeft = (detail: ObservedDetail, current: number, exitSequence: number): number =>
    countStopsLeft(detail.stop_times?.features ?? [], current, exitSequence);

const lastSequence = (detail: ObservedDetail): number | null => {
    let last: number | null = null;
    for (const s of detail.stop_times?.features ?? []) last = Math.max(last ?? 0, Number(s.properties.stop_sequence));
    return last;
};

/** The exit moment a live position shows: `arrived` at the exit or the trip's end, `next` one stop before; null without a position. */
export const rideAlertFor = (observation: TripObservation, exitSequence: number): RideAlert | null => {
    const current = currentStop(observation);
    if (observation.kind !== 'realtime' || current === null) return null;
    const last = lastSequence(observation.detail);
    if (current >= exitSequence || (last !== null && current >= last)) return 'arrived';
    return stopsLeft(observation.detail, current, exitSequence) === 1 ? 'next' : null;
};

/** Whether a rider is close enough to their exit for the short alarm interval. */
export const isNearExit = (observation: TripObservation, exitSequence: number): boolean => {
    const current = currentStop(observation);
    return observation.kind === 'realtime' && current !== null && stopsLeft(observation.detail, current, exitSequence) <= RIDE_PUSH.NEAR_STOPS;
};
