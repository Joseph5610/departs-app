import { RIDE_PUSH } from '../../_core/config';
import type { AppVehicleDetail } from '../../_core/types';
import { toSecs, wrapDaySeconds } from '../../_core/utils/time';
import { hasLeftStop } from './rideAlert';

/** `soon`: the trip leaves the rider's stop within their lead time; `cancelled`: the feed reports the trip cancelled. */
export type DepartureAlert = 'soon' | 'cancelled';

/** `passed`: the vehicle is already past the rider's stop, so the reminder is dropped unsent. */
export type DepartureAlertDecision = DepartureAlert | 'passed' | null;

type DepartureDetail = Pick<AppVehicleDetail, 'is_static_fallback' | 'state_position' | 'last_stop_sequence' | 'stop_times' | 'delay'>;

export interface DepartureReminderTiming {
    /** The rider's stop on the trip. */
    boardSequence: number;
    /** Timetable departure from that stop, epoch ms (the app resolves the service day). */
    scheduledMs: number;
    leadMin: number;
}

/** Seconds the trip runs late at the rider's stop: that stop's own realtime time, else the trip's delay, else on time. */
const delayAtStop = (detail: DepartureDetail, boardSequence: number): number => {
    const stop = detail.stop_times?.features.find(s => Number(s.properties.stop_sequence) === boardSequence)?.properties;
    if (stop?.realtime_departure_time && stop.departure_time) return wrapDaySeconds(toSecs(stop.realtime_departure_time) - toSecs(stop.departure_time));
    return typeof detail.delay === 'number' ? detail.delay : 0;
};

/** When the trip is expected to leave the rider's stop; the timetable time while there is no detail. */
export const predictedDepartureMs = (detail: DepartureDetail | null, timing: DepartureReminderTiming): number =>
    detail && !detail.is_static_fallback ? timing.scheduledMs + delayAtStop(detail, timing.boardSequence) * 1000 : timing.scheduledMs;

/** What a reminder is due now; a timetable-only detail (or none) reminds on the timetable time. */
export const departureAlertFor = (detail: DepartureDetail | null, timing: DepartureReminderTiming, now: number): DepartureAlertDecision => {
    if (detail?.state_position === 'canceled') return 'cancelled';
    const left = detail ? hasLeftStop(detail, timing.boardSequence) : null;
    if (left) return 'passed';
    // Without a live position the clock tells, once the departure is behind; a failed read (no detail) tells nothing yet.
    if (left === null && now > predictedDepartureMs(detail, timing)) return detail ? 'passed' : null;
    const dueAt = predictedDepartureMs(detail, timing) - timing.leadMin * 60_000;
    return dueAt - now <= RIDE_PUSH.SEND_WINDOW_MS ? 'soon' : null;
};

/** Whole minutes until the predicted departure, at least 1, for the notification text. */
export const minutesUntilDeparture = (detail: DepartureDetail | null, timing: DepartureReminderTiming, now: number): number =>
    Math.max(1, Math.round((predictedDepartureMs(detail, timing) - now) / 60_000));

/** The next check: halfway to the moment the reminder is due, never sooner than the minimum interval, nor later than that moment. */
export const nextCheckAt = (detail: DepartureDetail | null, timing: DepartureReminderTiming, now: number): number => {
    const dueAt = predictedDepartureMs(detail, timing) - timing.leadMin * 60_000;
    const firstCheck = dueAt - RIDE_PUSH.FIRST_CHECK_BEFORE_MS;
    if (firstCheck > now) return firstCheck;
    return Math.max(now + RIDE_PUSH.MIN_CHECK_INTERVAL_MS, Math.min(dueAt, now + (dueAt - now) / 2));
};
