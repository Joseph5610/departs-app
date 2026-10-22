import { useRideStore } from '@/state/rideStore';

/** Why a departure row stands out: the trip being ridden, followed, or the one the board was opened from. */
export type TripMark = 'riding' | 'watched' | 'viewed';

export const useTripMark = (tripId: string | undefined, isHighlighted: boolean): TripMark | null => {
    const isRiding = useRideStore(s => !!tripId && s.trips.some(trip => trip.tripId === tripId));
    const isWatched = useRideStore(s => !!tripId && s.followed?.tripId === tripId);
    if (isRiding) return 'riding';
    if (isWatched) return 'watched';
    return isHighlighted ? 'viewed' : null;
};
