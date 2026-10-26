import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { RIDE_PROTOCOL, tripNotificationTag } from '@shared/rides';
import { boardingAlertStep, type BoardingSeen } from '@/domain/rides';
import type { MyTripStatus } from '@/types';
import { alertRider } from './useRideAlerts';

/**
 * Alerts once when this view sees a trip's boarding come within its lead time: a toast while the server pushes it,
 * else a system notification (`boardingAlertStep` decides).
 */
export const useBoardingAlert = (status: MyTripStatus | null) => {
    const { t } = useTranslation();
    const boarding = status?.phase === 'boarding' ? status : null;
    const tripId = boarding?.trip.tripId ?? null;
    const isSoon = !!boarding?.isSoon;
    const title = boarding ? t('myTrip.boardPushTitle', { line: boarding.routeName, stop: boarding.stopName }) : '';
    const body = boarding ? t('myTrip.boardPushBody', { min: boarding.minutes }) : '';
    const pushed = boarding?.trip.pushed ?? false;
    const seen = useRef<BoardingSeen | null>(null);

    useEffect(() => {
        const step = boardingAlertStep(seen.current, { tripId, isSoon });
        seen.current = step.seen;
        if (!tripId || !step.alert) return;
        void alertRider(title, body, tripNotificationTag(RIDE_PROTOCOL.BOARD_TAG, tripId), pushed);
    }, [tripId, isSoon, title, body, pushed]);
};
