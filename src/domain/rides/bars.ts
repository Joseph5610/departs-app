import type { MyTripStatus, RideKind, RideStatus } from '@/types';
import { byUrgency, followedUrgency, tripUrgency } from './myTrip';
import { isRideShown } from './status';

/** What a ride's bar shows besides its texts: emphasis, what it lists and how its arrival time reads. */
export interface RideBarState {
    /** At the stop before the exit, or arrived: the bar asks for attention. */
    isAccent: boolean;
    /** Still under way with a known state, so it can be shared or followed with alerts. */
    isLive: boolean;
    showStopsLeft: boolean;
    showArrival: boolean;
    /** The arrival runs late or early by at least half a minute; null on time or unknown. */
    delayTone: 'late' | 'early' | null;
}

export const rideBarState = ({ phase, stopsLeft, arrivalTime, delay }: Pick<RideStatus, 'phase' | 'stopsLeft' | 'arrivalTime' | 'delay'>): RideBarState => {
    const isArrived = phase === 'arrived';
    const delayMins = delay !== null ? Math.round(delay / 60) : 0;
    return {
        isAccent: phase === 'next' || isArrived,
        isLive: !isArrived && phase !== 'unavailable',
        showStopsLeft: (phase === 'riding' || phase === 'next') && stopsLeft !== null,
        showArrival: !!arrivalTime && !isArrived,
        delayTone: delayMins > 0 ? 'late' : delayMins < 0 ? 'early' : null,
    };
};

/** One bar above the map: whose trip, and its state. */
export interface TripBar {
    key: string;
    kind: RideKind;
    status: MyTripStatus;
}

/**
 * The bars to show, most urgent first (a followed trip behind the user's own at the same moment), leaving out trips
 * without a state and rides still loading.
 */
export const tripBars = (own: readonly (MyTripStatus | null)[], followed: MyTripStatus | null): TripBar[] => {
    const shown = (status: MyTripStatus | null): status is MyTripStatus => !!status && (status.phase === 'boarding' || isRideShown(status.ride));
    return byUrgency([
        ...own.filter(shown).map(status => ({ key: status.trip.tripId, kind: 'own' as const, status, urgency: tripUrgency(status) })),
        ...(shown(followed) ? [{ key: 'followed', kind: 'followed' as const, status: followed, urgency: followedUrgency(followed) }] : []),
    ]).map(({ key, kind, status }) => ({ key, kind, status }));
};
