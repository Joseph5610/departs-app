import { useEffect, useRef } from 'react';
import { MY_TRIP_CONFIG } from '@/config/constants';
import { useRideStore } from '@/state/rideStore';
import { registrationChange } from '@/domain/rides';
import { RIDE_PROTOCOL, tripNotificationTag } from '@shared/rides';
import { closeRideNotifications, stopTripPush } from '@/lib/push';
import type { MyTrip } from '@/types';

/**
 * Once a trip ends, or a save leaves it nothing to push, wherever that happens: withdraws its registration from the
 * server and, once the trip is gone, clears its notifications. A save that still pushes needs nothing here: its new
 * registration replaces the old one on the server. A withdrawal that didn't reach the server (offline) is sent again
 * on the next start and whenever the device comes back online.
 */
export const useRidePush = () => {
    const trips = useRideStore(s => s.trips);
    const { queueWithdrawal, clearWithdrawal } = useRideStore(s => s.actions);
    const last = useRef<MyTrip[]>(trips);

    useEffect(() => {
        const retry = () => {
            for (const owed of useRideStore.getState().withdrawals) {
                if (Date.now() - owed.at > MY_TRIP_CONFIG.WITHDRAWAL_KEEP_MS) clearWithdrawal(owed.tripId);
                else void stopTripPush(owed).then(ok => { if (ok) clearWithdrawal(owed.tripId); });
            }
        };
        retry();
        window.addEventListener('online', retry);
        return () => window.removeEventListener('online', retry);
    }, [clearWithdrawal]);

    useEffect(() => {
        const previous = last.current;
        last.current = trips;
        for (const old of previous) {
            const current = trips.find(t => t.tripId === old.tripId);
            if (current === old) continue;
            if (registrationChange(old, current) === 'withdraw') void stopTripPush(old).then(ok => { if (!ok) queueWithdrawal(old); });
            if (current) continue;
            void closeRideNotifications(tripNotificationTag(RIDE_PROTOCOL.EXIT_TAG, old.tripId));
            void closeRideNotifications(tripNotificationTag(RIDE_PROTOCOL.BOARD_TAG, old.tripId));
        }
    }, [trips, queueWithdrawal]);
};
