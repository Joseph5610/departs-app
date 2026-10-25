import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DEPARTURE_REMINDER_TAG } from '@/config/constants';
import { tripNotificationTag } from '@/lib/push';
import { useRideStore } from '@/state/rideStore';
import type { MyTripStatus } from '@/types';
import { alertRider } from './useRideAlerts';

/**
 * Alerts once when a trip's boarding comes within its lead time: a system notification while the server can't push
 * it, else a toast. The trip remembers it, so a reload or a city switch and back doesn't alert again.
 */
export const useBoardingAlert = (status: MyTripStatus | null) => {
    const { t } = useTranslation();
    const { markBoardAlerted } = useRideStore(s => s.actions);
    const boarding = status?.phase === 'boarding' ? status : null;
    const tripId = boarding?.trip.tripId ?? null;
    const isDue = !!boarding?.isSoon && !boarding.trip.board?.alerted;
    const title = boarding ? t('myTrip.boardPushTitle', { line: boarding.routeName, stop: boarding.stopName }) : '';
    const body = boarding ? t('myTrip.boardPushBody', { min: boarding.minutes }) : '';
    const pushed = boarding?.trip.pushed ?? false;

    useEffect(() => {
        if (!tripId || !isDue) return;
        markBoardAlerted(tripId);
        void alertRider(title, body, tripNotificationTag(DEPARTURE_REMINDER_TAG, tripId), pushed);
    }, [tripId, isDue, title, body, pushed, markBoardAlerted]);
};
