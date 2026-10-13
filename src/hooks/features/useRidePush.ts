import { useEffect, useRef } from 'react';
import { useRideStore } from '@/state/rideStore';
import { followKey } from '@/domain/rides';
import { stopRidePush } from '@/lib/push';
import type { Ride } from '@/types';

/** Tells the server to stop pushing the user's ride once it ends or another one replaces it, wherever that happens. */
export const useRidePush = () => {
    const ride = useRideStore(s => s.ride);
    const last = useRef<Ride | null>(null);
    useEffect(() => {
        const previous = last.current;
        last.current = ride;
        if (previous && (!ride || followKey(previous) !== followKey(ride))) void stopRidePush(previous);
    }, [ride]);
};
