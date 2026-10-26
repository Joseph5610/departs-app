import { RIDE_PUSH } from '../../_core/config';
import { departureAlertFor, nextCheckAt, predictedDepartureMs, type DepartureReminderTiming } from './departureAlert';
import { isBoardingOver, TRIP_RULES } from '../../../shared/rides';
import { liveDetail, type TripObservation } from './observation';
import { isNearExit, rideAlertFor, type RideAlert } from './rideAlert';

/** `soon`/`cancelled`: before the trip leaves the rider's stop; `next`/`arrived`: before and at their exit. */
export type TripAlert = 'soon' | 'cancelled' | RideAlert;

/**
 * Where a rider is, only ever moving forward: `remind` waits to send the boarding alert, `board` waits for the vehicle
 * to leave the boarding stop, `ride` watches the exit, `near` has sent `next`, `done` is finished.
 */
export type RiderPhase = 'remind' | 'board' | 'ride' | 'near' | 'done';

export interface WatchBoard {
    /** The rider's boarding stop on the trip. */
    sequence: number;
    /** Timetable departure from it, epoch ms. */
    scheduledMs: number;
    /** Minutes before the departure the boarding alert comes; null: no boarding alert, the stop only starts the exit watch. */
    leadMin: number | null;
}

/** What a rider asked for: an alert before their exit (null: none) and/or before the trip leaves their stop. */
export interface WatchRequest {
    exitSequence: number | null;
    board: WatchBoard | null;
}

export interface WatchRider extends WatchRequest {
    phase: RiderPhase;
}

/** One alarm's outcome for a rider: the alerts to push now, the phase reached, and when to look again (null once done). */
export interface RiderStep {
    send: TripAlert[];
    phase: RiderPhase;
    nextAt: number | null;
}

/** A boarding stop as the departure alert reads it; no lead counts as 0. */
export const timingOf = (board: WatchBoard): DepartureReminderTiming =>
    ({ boardSequence: board.sequence, scheduledMs: board.scheduledMs, leadMin: board.leadMin ?? 0 });

/** Where a new registration starts: at its boarding alert, else waiting to board, else done (nothing to alert). */
export const initialPhase = (request: WatchRequest): RiderPhase =>
    request.board?.leadMin != null ? 'remind' : request.board || request.exitSequence !== null ? 'board' : 'done';

/** Riding to an exit, so a live position is what the alerts depend on. */
export const isWatchingExit = (phase: RiderPhase): boolean => phase === 'ride' || phase === 'near';

/** Whether the rider is past boarding: no boarding stop, the vehicle left it, or (by the clock) its departure is behind. */
const isBoarded = (observation: TripObservation, board: WatchBoard | null, now: number): boolean =>
    !board || isBoardingOver(liveDetail(observation), board.sequence, predictedDepartureMs(observation, timingOf(board)), now);

/** When a rider waiting to board needs a look: once boarded without an exit, else when the exit watch starts. */
const boardWakeAt = (rider: WatchRequest, observation: TripObservation, now: number): number => {
    if (!rider.board) return now;
    const predicted = predictedDepartureMs(observation, timingOf(rider.board));
    if (rider.exitSequence === null) return predicted + TRIP_RULES.BOARD_GRACE_MS;
    const watchFrom = predicted - RIDE_PUSH.FIRST_CHECK_BEFORE_MS;
    return watchFrom > now ? watchFrom : now + RIDE_PUSH.FAR_INTERVAL_S * 1000;
};

const wakeAt = (rider: WatchRider, phase: RiderPhase, observation: TripObservation, now: number): number | null => {
    if (phase === 'done') return null;
    if (isWatchingExit(phase)) {
        const near = rider.exitSequence !== null && isNearExit(observation, rider.exitSequence);
        return now + (near ? RIDE_PUSH.NEAR_INTERVAL_S : RIDE_PUSH.FAR_INTERVAL_S) * 1000;
    }
    const boardWake = boardWakeAt(rider, observation, now);
    return phase === 'remind' && rider.board ? Math.min(nextCheckAt(observation, timingOf(rider.board), now), boardWake) : boardWake;
};

/**
 * A rider's alarm, moving their phase forward: the boarding alert once inside its lead (by the live delay at the stop,
 * else the timetable), boarding once the vehicle left the stop, then `next` and `arrived` before the exit.
 */
export const riderStep = (rider: WatchRider, observation: TripObservation, now: number): RiderStep => {
    const send: TripAlert[] = [];
    let phase = rider.phase;
    if (phase === 'remind' && rider.board) {
        const decision = departureAlertFor(observation, timingOf(rider.board), now);
        if (decision === 'cancelled') return { send: ['cancelled'], phase: 'done', nextAt: null };
        if (decision === 'soon') send.push('soon');
        if (decision !== null) phase = 'board';
    }
    if ((phase === 'remind' && !rider.board) || (phase === 'board' && isBoarded(observation, rider.board, now))) {
        phase = rider.exitSequence === null ? 'done' : 'ride';
    }
    if (isWatchingExit(phase) && rider.exitSequence !== null) {
        const alert = rideAlertFor(observation, rider.exitSequence);
        if (alert === 'arrived') {
            send.push('arrived');
            phase = 'done';
        } else if (alert === 'next' && phase === 'ride') {
            send.push('next');
            phase = 'near';
        }
    }
    return { send, phase, nextAt: wakeAt(rider, phase, observation, now) };
};

/**
 * When a newly added rider first needs a look: now when an alert is already due or they ride to an exit already
 * aboard (the next stop may be theirs), else their boarding alert's first check or the exit watch's start.
 */
export const firstCheckAt = (rider: WatchRider, now: number): number => {
    const step = riderStep(rider, { kind: 'failed' }, now);
    if (step.send.length > 0 || isWatchingExit(step.phase)) return now;
    return Math.max(now, step.nextAt ?? now);
};
