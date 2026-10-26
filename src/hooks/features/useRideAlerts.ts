import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { RIDE_CONFIG } from '@/config/constants';
import { RIDE_PROTOCOL, tripNotificationTag } from '@shared/rides';
import { SITE } from '@/config/site';
import type { RideKind, RidePhase, RideStatus } from '@/types';
import { rideAlertFor } from '@/domain/rides';
import { useWakeLock } from './useWakeLock';

/**
 * A system notification when permitted, since the screen stays on during a ride; otherwise, or when the server
 * pushes the alert itself (`pushed`), a toast and vibration.
 */
export const alertRider = async (title: string, body: string, tag: string, pushed: boolean) => {
    navigator.vibrate?.(RIDE_CONFIG.VIBRATE_PATTERN);
    if (pushed || typeof Notification === 'undefined' || Notification.permission !== 'granted') {
        toast(title, { description: body });
        return;
    }
    try {
        // Android Chrome only shows notifications through the service worker.
        const registration = await navigator.serviceWorker?.getRegistration();
        if (registration) await registration.showNotification(title, { body, tag, icon: '/icon.png' });
        else new Notification(title, { body, tag });
    } catch {
        toast(title, { description: body });
    }
};

/**
 * Alerts on reaching the stop before the exit and on arrival, ends a finished or expired ride, and keeps the screen on
 * while the user's own ride is under way.
 */
export const useRideAlerts = (status: RideStatus | null, kind: RideKind, { isOver, end, silent = false, afterBoarding = false }: {
    /** The ride is stored but has no status any more (expired, or long arrived). */
    isOver: boolean;
    end: () => void;
    /** A trip ridden to its end without a picked exit: no alerts of its own. */
    silent?: boolean;
    /** The ride follows a boarding this view saw, so its first phase is news (e.g. straight to `next`), not a resumed ride. */
    afterBoarding?: boolean;
}) => {
    const { t } = useTranslation();
    const watching = kind === 'followed';
    const lastPhase = useRef<RidePhase | null>(null);
    /** Phases already alerted for the current ride, so a phase regained after a failed refresh doesn't alert again. */
    const alerted = useRef<{ ride: number | null; phases: Set<RidePhase> }>({ ride: null, phases: new Set() });

    const phase = status?.phase ?? null;
    const exitStopName = status?.exitStopName ?? '';
    const pushed = status?.ride.pushed ?? false;
    const tripId = status?.ride.tripId ?? '';
    const rideKey = status?.ride.startedAt ?? null;
    const [startedRide, setStartedRide] = useState<number | null>(null);
    if ((phase === 'riding' || phase === 'next') && rideKey !== null && startedRide !== rideKey) setStartedRide(rideKey);

    useEffect(() => {
        if (isOver) end();
    }, [isOver, end]);

    useEffect(() => {
        if (phase === 'loading' || phase === 'unavailable') return;
        if (alerted.current.ride !== rideKey) alerted.current = { ride: rideKey, phases: new Set() };
        const previous = lastPhase.current ?? (afterBoarding ? 'waiting' : null);
        lastPhase.current = phase;
        const alert = rideAlertFor(previous, phase, alerted.current.phases);
        if (!alert || silent) return;
        alerted.current.phases.add(alert);
        const tag = watching ? 'ride-followed' : tripNotificationTag(RIDE_PROTOCOL.EXIT_TAG, tripId);
        if (alert === 'next') void alertRider(t(watching ? 'share.watchNext' : 'ride.nextStop'), exitStopName, tag, pushed);
        else void alertRider(t(watching ? 'share.watchArrived' : 'ride.arrived', { stop: exitStopName }), SITE.NAME, tag, pushed);
    }, [phase, exitStopName, rideKey, watching, kind, pushed, silent, tripId, afterBoarding, t]);

    useEffect(() => {
        if (phase !== 'arrived') return;
        const timer = window.setTimeout(end, RIDE_CONFIG.ARRIVED_CLEAR_MS);
        return () => window.clearTimeout(timer);
    }, [phase, end]);

    // Stays on through a failed refresh once the trip is under way; off while still waiting to depart.
    useWakeLock(!watching && !silent && rideKey !== null && startedRide === rideKey && phase !== 'arrived');
};
