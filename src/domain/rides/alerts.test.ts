import { describe, expect, it } from 'vitest';
import type { RidePhase } from '@/types';
import { boardingAlertStep, NO_RIDE_ALERTS, rideAlertStep, type BoardingSeen, type RideAlertState } from './alerts';

/** Feeds a ride's phases through the alert step, as the view sees them update; returns the alerts given. */
const alertsFor = (phases: (RidePhase | null)[], { ride = 1, afterBoarding = false, silent = false, from = NO_RIDE_ALERTS }: {
    ride?: number;
    afterBoarding?: boolean;
    silent?: boolean;
    from?: RideAlertState;
} = {}) => {
    let state = from;
    const given: string[] = [];
    for (const phase of phases) {
        const step = rideAlertStep(state, { ride, phase, afterBoarding, silent });
        state = step.state;
        if (step.alert) given.push(step.alert);
    }
    return { given, state };
};

describe('rideAlertStep', () => {
    it('alerts the stop before the exit and the arrival, once each', () => {
        expect(alertsFor(['waiting', 'riding', 'next', 'next', 'arrived', 'arrived']).given).toEqual(['next', 'arrived']);
    });

    // A reload mid-ride must not repeat what the user was already told.
    it('stays quiet for a ride first seen mid-way', () => {
        expect(alertsFor(['next', 'arrived']).given).toEqual(['arrived']);
        expect(alertsFor(['arrived']).given).toEqual([]);
    });

    it('alerts a first phase that follows a boarding this view saw', () => {
        expect(alertsFor(['next'], { afterBoarding: true }).given).toEqual(['next']);
    });

    // I3: a failed refresh between two phases neither alerts nor loses the alert after it.
    it('rides through loading and failed refreshes without repeating an alert', () => {
        expect(alertsFor(['riding', 'unavailable', 'next', 'loading', 'unavailable', 'next', 'arrived']).given).toEqual(['next', 'arrived']);
    });

    // A reload shows `loading` first: the phase after it is still a resumed ride, not news.
    it('treats the first phase after loading on a reload as resumed', () => {
        expect(alertsFor(['loading', 'next']).given).toEqual([]);
    });

    // A position that jitters back across the stop before the exit must not alert it twice.
    it('alerts next once even when the phase goes back and forth', () => {
        expect(alertsFor(['riding', 'next', 'riding', 'next']).given).toEqual(['next']);
    });

    it('never alerts a trip ridden to its end', () => {
        expect(alertsFor(['riding', 'next', 'arrived'], { silent: true }).given).toEqual([]);
    });

    it('starts afresh for another ride, and not before its first phase', () => {
        const { state } = alertsFor(['riding', 'next']);
        expect(alertsFor(['riding', 'next'], { ride: 2, from: state }).given).toEqual(['next']);
    });
});

/** Feeds a view's boarding updates through the step; returns how many alerts it gave. */
const boardingAlerts = (updates: { tripId: string | null; isSoon: boolean }[]) => {
    let seen: BoardingSeen | null = null;
    let given = 0;
    for (const update of updates) {
        const step = boardingAlertStep(seen, update);
        seen = step.seen;
        if (step.alert) given++;
    }
    return given;
};

describe('boardingAlertStep', () => {
    it('alerts when boarding comes within the lead while shown', () => {
        expect(boardingAlerts([{ tripId: 't1', isSoon: false }, { tripId: 't1', isSoon: true }, { tripId: 't1', isSoon: true }])).toBe(1);
    });

    // I1: a delay estimate wobbling across the lead must not alert the same boarding twice.
    it('alerts a trip once even when it falls back out of its lead and in again', () => {
        expect(boardingAlerts([false, true, false, true].map(isSoon => ({ tripId: 't1', isSoon })))).toBe(1);
    });

    // A reload, a remount or another trip in the same slot must not alert a boarding already inside its lead.
    it('stays quiet for a trip first seen inside its lead', () => {
        expect(boardingAlerts([{ tripId: 't1', isSoon: true }])).toBe(0);
        expect(boardingAlerts([{ tripId: 't2', isSoon: false }, { tripId: 't1', isSoon: true }])).toBe(0);
        expect(boardingAlerts([{ tripId: null, isSoon: false }, { tripId: null, isSoon: true }])).toBe(0);
    });
});
