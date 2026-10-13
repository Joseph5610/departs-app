import { RIDE_PUSH_CONFIG } from '@/config/constants';
import { apiFetch } from '@/lib/apiClient';
import type { Ride } from '@/types';

/** The notification for each ride alert, in the rider's language: the server sends them as given. */
export interface RidePushTexts {
    next: { title: string; body: string };
    arrived: { title: string; body: string };
}

const applicationServerKey = (): Uint8Array<ArrayBuffer> => {
    const base64 = RIDE_PUSH_CONFIG.VAPID_PUBLIC_KEY.replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
};

const pushManager = async (): Promise<PushManager | null> => {
    if (typeof PushManager === 'undefined' || typeof Notification === 'undefined' || Notification.permission !== 'granted') return null;
    return (await navigator.serviceWorker?.getRegistration())?.pushManager ?? null;
};

const postRide = (city: string, body: object) =>
    apiFetch(`/${city}/ride`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

/** Asks the server to push this ride's alerts; false where push is unavailable (no permission, no service worker, iOS outside the installed app). */
export const startRidePush = async (ride: Pick<Ride, 'city' | 'tripId' | 'vehicleId' | 'exitSequence'>, texts: RidePushTexts): Promise<boolean> => {
    try {
        const manager = await pushManager();
        if (!manager) return false;
        const subscription = (await manager.getSubscription()) ?? (await manager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey() }));
        await postRide(ride.city, { action: 'add', tripId: ride.tripId, vehicleId: ride.vehicleId, exitSequence: ride.exitSequence, subscription: subscription.toJSON(), texts });
        return true;
    } catch {
        return false;
    }
};

/** Stops the server pushing a ride that ended or was replaced. */
export const stopRidePush = async (ride: Pick<Ride, 'city' | 'tripId' | 'vehicleId' | 'exitSequence'>): Promise<void> => {
    try {
        const subscription = await (await pushManager())?.getSubscription();
        if (subscription) await postRide(ride.city, { action: 'remove', tripId: ride.tripId, vehicleId: ride.vehicleId, exitSequence: ride.exitSequence, endpoint: subscription.endpoint });
    } catch {
        // The server drops the rider on its own once the ride arrives or expires.
    }
};
