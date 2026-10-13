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

const pushManager = async (): Promise<PushManager | null> =>
    typeof PushManager === 'undefined' ? null : (await navigator.serviceWorker?.getRegistration())?.pushManager ?? null;

/** `unsupported`: no Web Push here (e.g. iOS outside the installed app); any other reason is a failure worth showing. */
export type RidePushResult = { ok: true } | { ok: false; reason: string };

const postRide = (city: string, body: object) =>
    apiFetch(`/${city}/ride`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

/**
 * Subscribes to push and asks the server to push this ride's alerts. Must run from a tap: iOS only lets
 * `subscribe` ask for notification permission there.
 */
export const startRidePush = async (ride: Pick<Ride, 'city' | 'tripId' | 'vehicleId' | 'exitSequence'>, texts: RidePushTexts): Promise<RidePushResult> => {
    try {
        const manager = await pushManager();
        if (!manager) return { ok: false, reason: 'unsupported' };
        const subscription = (await manager.getSubscription()) ?? (await manager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey() }));
        await postRide(ride.city, { action: 'add', tripId: ride.tripId, vehicleId: ride.vehicleId, exitSequence: ride.exitSequence, subscription: subscription.toJSON(), texts });
        return { ok: true };
    } catch (error) {
        return { ok: false, reason: error instanceof Error ? `${error.name}: ${error.message}` : String(error) };
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
