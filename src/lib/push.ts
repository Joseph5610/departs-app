import { RIDE_PUSH_CONFIG } from '@/config/constants';
import { apiFetch } from '@/lib/apiClient';
import { watchFrom } from '@/domain/rides';
import type { MyTrip } from '@/types';

type PushText = { title: string; body: string };

/** Each alert's notification, in the rider's language: the server sends them as given; `soon` carries `MY_TRIP_CONFIG.MINUTES_TOKEN`. */
export interface TripPushTexts {
    next?: PushText;
    arrived?: PushText;
    soon?: PushText;
    cancelled?: PushText;
}

const applicationServerKey = (): Uint8Array<ArrayBuffer> => {
    const base64 = RIDE_PUSH_CONFIG.VAPID_PUBLIC_KEY.replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
};

const pushManager = async (): Promise<PushManager | null> =>
    (await navigator.serviceWorker?.getRegistration())?.pushManager ?? null;

/** `unsupported`: no Web Push here (e.g. iOS outside the installed app); any other reason is a failure worth showing. */
export type RidePushResult = { ok: true } | { ok: false; reason: string };

const postRide = (city: string, body: object) =>
    apiFetch(`/${city}/ride`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const queues = new Map<string, Promise<unknown>>();

/** Runs a trip's registrations one after another, so a removal can't overtake the save before it on the network. */
const inOrder = <T>(tripId: string, task: () => Promise<T>): Promise<T> => {
    const run = (queues.get(tripId) ?? Promise.resolve()).then(task, task);
    const settled = run.catch(() => undefined);
    queues.set(tripId, settled);
    void settled.then(() => { if (queues.get(tripId) === settled) queues.delete(tripId); });
    return run;
};

const failure = (error: unknown): RidePushResult =>
    ({ ok: false, reason: error instanceof Error ? `${error.name}: ${error.message}` : String(error) });

/** This device's push subscription, asking for notification permission when there is none. */
const ensureSubscription = async (manager: PushManager): Promise<PushSubscription> =>
    (await manager.getSubscription()) ?? (await manager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey() }));

/**
 * Subscribes to push and asks the server to push this trip's alerts: before it leaves the user's stop (a boarding
 * stop with a lead) and before their exit (unless ridden to its end). Replaces the device's earlier registration on
 * the trip, starting afresh. Must run from a tap: iOS only lets `subscribe` ask for notification permission there.
 */
export const startTripPush = async (trip: MyTrip, texts: TripPushTexts, path: string): Promise<RidePushResult> => {
    try {
        if (typeof PushManager === 'undefined') return { ok: false, reason: 'unsupported' };
        const manager = await pushManager();
        if (!manager) return { ok: false, reason: 'No service worker is registered' };
        const subscription = await ensureSubscription(manager);
        await inOrder(trip.tripId, () => postRide(trip.city, {
            action: 'add', tripId: trip.tripId, vehicleId: trip.vehicleId, exitSequence: trip.toEnd ? null : trip.exitSequence,
            board: watchFrom(trip), subscription: subscription.toJSON(), texts, path,
        }));
        return { ok: true };
    } catch (error) {
        return failure(error);
    }
};

/** A trip's notification tag, as the server builds it (`RIDE_PUSH.TAG` or `BOARD_TAG` plus the trip), so one trip's alerts replace each other but never another trip's. */
export const tripNotificationTag = (base: string, tripId: string): string => `${base}:${tripId}`;

/** Closes a ride's notifications still in the notification centre, e.g. a "next stop" kept until dismissed. */
export const closeRideNotifications = async (tag: string): Promise<void> => {
    try {
        const registration = await navigator.serviceWorker?.getRegistration();
        for (const notification of (await registration?.getNotifications({ tag })) ?? []) notification.close();
    } catch {
        // Nothing to close where notifications aren't supported.
    }
};

/** Stops the server pushing a trip's alerts. */
export const stopTripPush = (trip: Pick<MyTrip, 'city' | 'tripId' | 'vehicleId'>): Promise<void> => inOrder(trip.tripId, async () => {
    try {
        const subscription = await (await pushManager())?.getSubscription();
        if (subscription) {
            await postRide(trip.city, {
                action: 'remove', tripId: trip.tripId, vehicleId: trip.vehicleId, endpoint: subscription.endpoint,
            });
        }
    } catch {
        // The server drops the rider on its own once the trip arrives or expires.
    }
});
