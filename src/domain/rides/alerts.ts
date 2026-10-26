import type { RidePhase } from '@/types';
import { rideAlertFor } from './status';

/** What a ride's alerts remember between updates: the ride, the phase last seen, and the alerts already given. */
export interface RideAlertState {
    ride: number | null;
    last: RidePhase | null;
    alerted: readonly RidePhase[];
}

export const NO_RIDE_ALERTS: RideAlertState = { ride: null, last: null, alerted: [] };

/**
 * One update of a ride's phase: the alert it calls for and the state to keep. A ride first seen mid-way (a reload)
 * doesn't alert unless it follows a boarding this view saw; each alert comes once per ride; a silent ride (ridden to
 * its end) never alerts; loading or a failed refresh changes nothing.
 */
export const rideAlertStep = (state: RideAlertState, { ride, phase, afterBoarding, silent }: {
    ride: number | null;
    phase: RidePhase | null;
    afterBoarding: boolean;
    silent: boolean;
}): { state: RideAlertState; alert: 'next' | 'arrived' | null } => {
    if (phase === 'loading' || phase === 'unavailable') return { state, alert: null };
    const alerted = state.ride === ride ? state.alerted : [];
    const previous = state.last ?? (afterBoarding ? 'waiting' : null);
    const due = rideAlertFor(previous, phase, new Set(alerted));
    const alert = due && !silent ? due : null;
    return { state: { ride, last: phase, alerted: alert ? [...alerted, alert] : alerted }, alert };
};

/** A trip's boarding as one view saw it last, and whether it already alerted it. */
export interface BoardingSeen {
    tripId: string | null;
    isSoon: boolean;
    alerted: boolean;
}

/**
 * One update of a trip's boarding: alerts once per trip when it comes within its lead while this view shows it; a trip
 * first seen inside it (a reload) doesn't alert, nor one falling out of its lead and back in.
 */
export const boardingAlertStep = (previous: BoardingSeen | null, { tripId, isSoon }: { tripId: string | null; isSoon: boolean }): { seen: BoardingSeen; alert: boolean } => {
    const sameTrip = !!tripId && previous?.tripId === tripId;
    const alert = sameTrip && isSoon && !previous.isSoon && !previous.alerted;
    return { seen: { tripId, isSoon, alerted: alert || (sameTrip && previous.alerted) }, alert };
};
