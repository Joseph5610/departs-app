import { useEffect, useRef } from 'react';
import { useRideStore } from '@/state/rideStore';
import { tripPushKey } from '@/domain/rides';
import { RIDE_PROTOCOL, tripNotificationTag } from '@shared/rides';
import { closeRideNotifications, stopTripPush } from '@/lib/push';
import type { MyTrip } from '@/types';

/**
 * Once a trip ends, or a save leaves it nothing to push, wherever that happens: withdraws its registration from the
 * server and, once the trip is gone, clears its notifications. A save that still pushes needs nothing here: its new
 * registration replaces the old one on the server.
 */
export const useRidePush = () => {
    const trips = useRideStore(s => s.trips);
    const last = useRef<MyTrip[]>(trips);
    useEffect(() => {
        const previous = last.current;
        last.current = trips;
        for (const old of previous) {
            const current = trips.find(t => t.tripId === old.tripId);
            if (current === old) continue;
            if (tripPushKey(old) !== null && (!current || tripPushKey(current) === null)) void stopTripPush(old);
            if (current) continue;
            void closeRideNotifications(tripNotificationTag(RIDE_PROTOCOL.EXIT_TAG, old.tripId));
            void closeRideNotifications(tripNotificationTag(RIDE_PROTOCOL.BOARD_TAG, old.tripId));
        }
    }, [trips]);
};
