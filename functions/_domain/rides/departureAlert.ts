import { RIDE_PUSH } from '../../_core/config';
import { delayAtStop } from '../../../shared/rides';
import { hasLeftStop, type TripObservation } from './observation';

/** `soon`: the trip leaves the rider's stop within their lead time; `cancelled`: the feed reports the trip cancelled. */
export type DepartureAlert = 'soon' | 'cancelled';

/** `passed`: the vehicle is already past the rider's stop, so the reminder is dropped unsent. */
export type DepartureAlertDecision = DepartureAlert | 'passed' | null;

export interface DepartureReminderTiming {
    /** The rider's stop on the trip. */
    boardSequence: number;
    /** Timetable departure from that stop, epoch ms (the app resolves the service day). */
    scheduledMs: number;
    leadMin: number;
}

/** When the trip is expected to leave the rider's stop: with the realtime delay, else on the timetable. */
export const predictedDepartureMs = (observation: TripObservation, timing: DepartureReminderTiming): number =>
    observation.kind === 'realtime' ? timing.scheduledMs + (delayAtStop(observation.detail.stop_times?.features ?? [], timing.boardSequence, observation.detail.delay) ?? 0) * 1000
        : timing.scheduledMs;

/**
 * What a reminder is due now. Without a live position the clock drops it once the departure is behind, except after a
 * failed read, which says nothing about a late trip.
 */
export const departureAlertFor = (observation: TripObservation, timing: DepartureReminderTiming, now: number): DepartureAlertDecision => {
    if (observation.kind === 'cancelled') return 'cancelled';
    const left = hasLeftStop(observation, timing.boardSequence);
    if (left) return 'passed';
    const predicted = predictedDepartureMs(observation, timing);
    if (left === null && now > predicted) return observation.kind === 'failed' ? null : 'passed';
    return predicted - timing.leadMin * 60_000 - now <= RIDE_PUSH.SEND_WINDOW_MS ? 'soon' : null;
};

/** Whole minutes until the predicted departure, at least 1, for the notification text. */
export const minutesUntilDeparture = (observation: TripObservation, timing: DepartureReminderTiming, now: number): number =>
    Math.max(1, Math.round((predictedDepartureMs(observation, timing) - now) / 60_000));

/** The next check: halfway to the moment the reminder is due, never sooner than the minimum interval, nor later than that moment. */
export const nextCheckAt = (observation: TripObservation, timing: DepartureReminderTiming, now: number): number => {
    const dueAt = predictedDepartureMs(observation, timing) - timing.leadMin * 60_000;
    const firstCheck = dueAt - RIDE_PUSH.FIRST_CHECK_BEFORE_MS;
    if (firstCheck > now) return firstCheck;
    return Math.max(now + RIDE_PUSH.MIN_CHECK_INTERVAL_MS, Math.min(dueAt, now + (dueAt - now) / 2));
};
