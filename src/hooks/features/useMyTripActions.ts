import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { MY_TRIP_CONFIG } from '@/config/constants';
import { RIDE_PROTOCOL } from '@shared/rides';
import { SITE } from '@/config/site';
import { tripPushKey, withPushState } from '@/domain/rides';
import { requestNotificationPermission } from '@/lib/notifications';
import { startTripPush, stopTripPush } from '@/lib/push';
import { paths } from '@/lib/routes';
import { useRideStore } from '@/state/rideStore';
import type { MyTrip } from '@/types';

/**
 * Saves or ends a My trip. A save that changes what is pushed registers the trip with the server afresh, replacing the
 * earlier registration; if that fails, the earlier one is withdrawn so it can't alert on the old stops, and the app
 * alerts while open instead. Must run from a tap: iOS only asks for notification permission there.
 */
export const useMyTripActions = () => {
    const { t } = useTranslation();
    const { saveTrip, endTrip, markTripPushed } = useRideStore(s => s.actions);

    const save = useCallback((draft: Omit<MyTrip, 'startedAt'>, line: string, exitStopName: string): boolean => {
        const previous = useRideStore.getState().trips.find(x => x.tripId === draft.tripId);
        const trip = withPushState(draft, previous);
        if (!saveTrip(trip)) {
            toast(t('myTrip.limit', { count: MY_TRIP_CONFIG.MAX_TRIPS }));
            return false;
        }
        toast(previous ? t('myTrip.updated') : t('myTrip.saved'));
        const key = tripPushKey(trip);
        // An unchanged trip the server already pushes needs nothing; one whose registration failed gets another try.
        if (key === null || (previous?.pushed && key === tripPushKey(previous))) return true;

        const board = trip.board;
        const boardTitle = board ? t('myTrip.boardPushTitle', { line, stop: board.stopName }) : '';
        void startTripPush({ ...trip, startedAt: previous?.startedAt ?? Date.now() }, {
            next: trip.toEnd ? undefined : { title: t('ride.nextStop'), body: exitStopName },
            arrived: trip.toEnd ? undefined : { title: t('ride.arrived', { stop: exitStopName }), body: SITE.NAME },
            soon: board?.leadMin != null ? { title: boardTitle, body: t('myTrip.boardPushBody', { min: RIDE_PROTOCOL.MINUTES_TOKEN }) } : undefined,
            cancelled: board?.leadMin != null ? { title: boardTitle, body: t('myTrip.cancelledBody') } : undefined,
        }, paths.trip(trip.city, trip.tripId, trip.vehicleId)).then(result => {
            if (result.ok) {
                markTripPushed(trip.tripId, key);
                return;
            }
            if (previous && tripPushKey(previous) !== null) void stopTripPush(previous);
            if (result.reason !== 'unsupported' && !result.reason.startsWith('NotAllowedError')) toast(t('myTrip.inAppOnly'), { description: result.reason });
            void requestNotificationPermission();
        });
        return true;
    }, [saveTrip, markTripPushed, t]);

    return { save, end: endTrip };
};
