import { RIDE_PUSH } from '../../_core/config';
import type { AppVehicleDetail } from '../../_core/types';
import { departureAlertFor, nextCheckAt, predictedDepartureMs } from './departureAlert';
import { isNearExit, liveStopSequence, rideAlertFor, type RideAlert } from './rideAlert';

/** `soon`/`cancelled`: before the trip leaves the rider's stop; `next`/`arrived`: before and at their exit. */
export type TripAlert = 'soon' | 'cancelled' | RideAlert;

export interface WatchBoard {
    /** The rider's boarding stop on the trip. */
    sequence: number;
    /** Timetable departure from it, epoch ms. */
    scheduledMs: number;
    /** Minutes before the departure the boarding alert comes; null: no boarding alert, the stop only starts the exit watch. */
    leadMin: number | null;
}

/** What a rider asked for: an alert before their exit (null: none) and/or before the trip leaves their stop. */
export interface WatchRider {
    exitSequence: number | null;
    board: WatchBoard | null;
    alerted: TripAlert[];
}

type WatchDetail = Pick<AppVehicleDetail, 'is_static_fallback' | 'state_position' | 'last_stop_sequence' | 'stop_times' | 'delay'>;

/** One alarm's outcome for a rider: the alerts to push now, whether the rider is finished, and when to look again. */
export interface RiderStep {
    send: TripAlert[];
    /** `soon` marked even when it went unsent because the vehicle had already left, so it never goes out late. */
    alerted: TripAlert[];
    done: boolean;
    /** Aboard and riding to an exit, so a live position is what the alerts depend on. */
    watchingExit: boolean;
    /** Null once done. */
    nextAt: number | null;
}

/** Whether the rider is past boarding: no boarding stop, the vehicle left it, or (without a position) its departure is behind. */
const isBoarded = (detail: WatchDetail | null, board: WatchBoard | null, now: number): boolean => {
    if (!board) return true;
    const current = detail ? liveStopSequence(detail) : null;
    if (current !== null && (current > board.sequence || (current === board.sequence && detail?.state_position !== 'at_stop'))) return true;
    const timing = { boardSequence: board.sequence, scheduledMs: board.scheduledMs, leadMin: board.leadMin ?? 0 };
    return now > predictedDepartureMs(detail, timing) + RIDE_PUSH.BOARD_GRACE_MS;
};

/**
 * A rider's alarm: the boarding alert once it falls inside its lead (by the live delay at the stop, else the timetable),
 * then, once aboard, `next` and `arrived` before the exit. Without a detail only the boarding alert can go, on the
 * timetable. The exit watch starts `FIRST_CHECK_BEFORE_MS` before the departure, not when the trip was saved.
 */
export const riderStep = (rider: WatchRider, detail: WatchDetail | null, now: number): RiderStep => {
    const send: TripAlert[] = [];
    const alerted = [...rider.alerted];
    const board = rider.board;
    let nextAt = Number.POSITIVE_INFINITY;

    const boardPending = !!board && board.leadMin !== null && !alerted.includes('soon') && !alerted.includes('cancelled');
    if (board && board.leadMin !== null && boardPending) {
        const timing = { boardSequence: board.sequence, scheduledMs: board.scheduledMs, leadMin: board.leadMin };
        const decision = departureAlertFor(detail, timing, now);
        if (decision === 'cancelled') return { send: ['cancelled'], alerted: [...alerted, 'cancelled'], done: true, watchingExit: false, nextAt: null };
        if (decision === 'soon') send.push('soon');
        if (decision !== null) alerted.push('soon');
        else nextAt = Math.min(nextAt, nextCheckAt(detail, timing, now));
    }

    if (rider.exitSequence === null) {
        if (!board || board.leadMin === null) return { send, alerted, done: true, watchingExit: false, nextAt: null };
        if (!alerted.includes('soon')) return { send, alerted, done: false, watchingExit: false, nextAt };
        // Kept until the trip has left, so a re-save adding an exit knows the boarding alert already went.
        if (isBoarded(detail, board, now)) return { send, alerted, done: true, watchingExit: false, nextAt: null };
        const timing = { boardSequence: board.sequence, scheduledMs: board.scheduledMs, leadMin: board.leadMin };
        return { send, alerted, done: false, watchingExit: false, nextAt: predictedDepartureMs(detail, timing) + RIDE_PUSH.BOARD_GRACE_MS };
    }

    if (isBoarded(detail, board, now)) {
        const exitAlerts = alerted.filter((a): a is RideAlert => a === 'next' || a === 'arrived');
        const alert = detail ? rideAlertFor(detail, rider.exitSequence, exitAlerts) : null;
        if (alert) {
            send.push(alert);
            alerted.push(alert);
        }
        if (alert === 'arrived') return { send, alerted, done: true, watchingExit: false, nextAt: null };
        const near = !!detail && isNearExit(detail, rider.exitSequence);
        nextAt = Math.min(nextAt, now + (near ? RIDE_PUSH.NEAR_INTERVAL_S : RIDE_PUSH.FAR_INTERVAL_S) * 1000);
        return { send, alerted, done: false, watchingExit: true, nextAt };
    }
    if (board) {
        const timing = { boardSequence: board.sequence, scheduledMs: board.scheduledMs, leadMin: board.leadMin ?? 0 };
        const watchFrom = predictedDepartureMs(detail, timing) - RIDE_PUSH.FIRST_CHECK_BEFORE_MS;
        nextAt = Math.min(nextAt, watchFrom > now ? watchFrom : now + RIDE_PUSH.FAR_INTERVAL_S * 1000);
    }
    return { send, alerted, done: false, watchingExit: false, nextAt };
};

/**
 * When a newly added rider first needs a look: now when an alert is already due or they ride to an exit already
 * aboard (the next stop may be theirs), else their boarding alert's first check or the exit watch's start.
 */
export const firstCheckAt = (rider: Pick<WatchRider, 'board' | 'exitSequence' | 'alerted'>, now: number): number => {
    const step = riderStep(rider, null, now);
    if (step.send.length > 0 || step.watchingExit) return now;
    return Math.max(now, step.nextAt ?? now);
};

/**
 * The alerts a replacing registration has already had: the boarding alert while it boards at the same stop, the exit
 * alerts while it gets off at the same stop. So a re-save (another lead, another exit) doesn't send them again.
 */
export const carriedAlerts = (previous: Pick<WatchRider, 'board' | 'exitSequence' | 'alerted'> | undefined, next: Pick<WatchRider, 'board' | 'exitSequence'>): TripAlert[] => {
    if (!previous) return [];
    const sameBoard = !!previous.board && previous.board.sequence === next.board?.sequence;
    const sameExit = previous.exitSequence !== null && previous.exitSequence === next.exitSequence;
    return previous.alerted.filter(a => (a === 'soon' || a === 'cancelled' ? sameBoard : sameExit));
};

/** Whether the rider is in the stretch where a live position matters: their boarding alert is close, or they ride to an exit. */
export const needsLiveDetail = (rider: Pick<WatchRider, 'board' | 'exitSequence'>, now: number): boolean => {
    const board = rider.board;
    if (!board) return rider.exitSequence !== null;
    const leadMs = (board.leadMin ?? 0) * 60_000;
    return now >= board.scheduledMs - leadMs - RIDE_PUSH.FIRST_CHECK_BEFORE_MS;
};
