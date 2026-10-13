import { useEffect, useRef } from 'react';
import { useRideStore } from '@/state/rideStore';
import { followKey } from '@/domain/rides';
import { RIDE_PUSH_CONFIG } from '@/config/constants';
import { closeRideNotifications, stopRidePush } from '@/lib/push';
import type { Ride } from '@/types';

/** Once the user's ride ends or another replaces it, wherever that happens: stops its pushes and clears its notifications. */
export const useRidePush = () => {
    const ride = useRideStore(s => s.ride);
    const last = useRef<Ride | null>(null);
    useEffect(() => {
        const previous = last.current;
        last.current = ride;
        if (!previous || (ride && followKey(previous) === followKey(ride))) return;
        void stopRidePush(previous);
        void closeRideNotifications(RIDE_PUSH_CONFIG.NOTIFICATION_TAG);
    }, [ride]);
};
