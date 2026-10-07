import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useRideStore } from '@/state/rideStore';
import { RIDE_CONFIG } from '@/config/constants';
import { SITE } from '@/config/site';
import type { RideKind, RidePhase, RideStatus } from '@/types';
import { rideAlertFor } from '@/domain/rides';
import { useWakeLock } from './useWakeLock';

/** A system notification when permitted, since the screen stays on during a ride; otherwise a toast and vibration. */
const alertRider = async (title: string, body: string, tag: string) => {
    navigator.vibrate?.(RIDE_CONFIG.VIBRATE_PATTERN);
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
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
export const useRideAlerts = (status: RideStatus | null, kind: RideKind) => {
    const { t } = useTranslation();
    const hasRide = useRideStore(s => (kind === 'own' ? s.ride : s.followed) !== null);
    const { endRide, unfollow } = useRideStore(s => s.actions);
    const watching = kind === 'followed';
    // A followed ride the app ends itself (arrived or expired) is remembered, so its shared link doesn't follow it again.
    const end = useCallback(() => (watching ? unfollow(true) : endRide()), [watching, unfollow, endRide]);
    const lastPhase = useRef<RidePhase | null>(null);
    /** Phases already alerted for the current ride, so a phase regained after a failed refresh doesn't alert again. */
    const alerted = useRef<{ ride: number | null; phases: Set<RidePhase> }>({ ride: null, phases: new Set() });

    const phase = status?.phase ?? null;
    const exitStopName = status?.exitStopName ?? '';
    const rideKey = status?.ride.startedAt ?? null;
    const [startedRide, setStartedRide] = useState<number | null>(null);
    if ((phase === 'riding' || phase === 'next') && rideKey !== null && startedRide !== rideKey) setStartedRide(rideKey);

    useEffect(() => {
        if (hasRide && !status) end();
    }, [hasRide, status, end]);

    useEffect(() => {
        if (phase === 'loading' || phase === 'unavailable') return;
        if (alerted.current.ride !== rideKey) alerted.current = { ride: rideKey, phases: new Set() };
        const previous = lastPhase.current;
        lastPhase.current = phase;
        const alert = rideAlertFor(previous, phase, alerted.current.phases);
        if (!alert) return;
        alerted.current.phases.add(alert);
        if (alert === 'next') void alertRider(t(watching ? 'share.watchNext' : 'ride.nextStop'), exitStopName, `ride-${kind}`);
        else void alertRider(t(watching ? 'share.watchArrived' : 'ride.arrived', { stop: exitStopName }), SITE.NAME, `ride-${kind}`);
    }, [phase, exitStopName, rideKey, watching, kind, t]);

    useEffect(() => {
        if (phase !== 'arrived') return;
        const timer = window.setTimeout(end, RIDE_CONFIG.ARRIVED_CLEAR_MS);
        return () => window.clearTimeout(timer);
    }, [phase, end]);

    // Stays on through a failed refresh once the trip is under way; off while still waiting to depart.
    useWakeLock(!watching && rideKey !== null && startedRide === rideKey && phase !== 'arrived');
};
