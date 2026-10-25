import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DEPARTURE_REMINDER_TAG } from '@/config/constants';
import { tripNotificationTag } from '@/lib/push';
import type { MyTripStatus } from '@/types';
import { alertRider } from './useRideAlerts';

/**
 * Alerts once when this view sees a trip's boarding come within its lead time: a toast while the server pushes it,
 * else a system notification. A trip already inside its lead when first seen (a reload, a remount) doesn't alert.
 */
export const useBoardingAlert = (status: MyTripStatus | null) => {
    const { t } = useTranslation();
    const boarding = status?.phase === 'boarding' ? status : null;
    const tripId = boarding?.trip.tripId ?? null;
    const isSoon = !!boarding?.isSoon;
    const title = boarding ? t('myTrip.boardPushTitle', { line: boarding.routeName, stop: boarding.stopName }) : '';
    const body = boarding ? t('myTrip.boardPushBody', { min: boarding.minutes }) : '';
    const pushed = boarding?.trip.pushed ?? false;
    const seen = useRef<{ tripId: string | null; isSoon: boolean } | null>(null);

    useEffect(() => {
        const previous = seen.current;
        seen.current = { tripId, isSoon };
        if (!tripId || !isSoon || previous?.tripId !== tripId || previous.isSoon) return;
        void alertRider(title, body, tripNotificationTag(DEPARTURE_REMINDER_TAG, tripId), pushed);
    }, [tripId, isSoon, title, body, pushed]);
};
