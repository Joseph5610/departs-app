import { RIDE_PUSH_CONFIG } from '@/config/constants';
import { apiFetch } from '@/lib/apiClient';
import { watchFrom } from '@/domain/rides';
import type { AppError, MyTrip } from '@/types';
import type { WatchedLine } from '@shared/alerts';

type PushText = { title: string; body: string };

/** Each alert's notification, in the rider's language: the server sends them as given; `soon` carries `RIDE_PROTOCOL.MINUTES_TOKEN`. */
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

/** `unsupported`: no Web Push here (e.g. iOS outside the installed app); `tooMany`: the server's daily quota for this network (disruptions only); any other reason is a failure worth showing. */
export type RidePushResult = { ok: true } | { ok: false; reason: string };

const postPush = (city: string, endpoint: 'ride' | 'disruptions', body: object) =>
    apiFetch(`/${city}/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const queues = new Map<string, Promise<unknown>>();

/** Runs one registration's requests (a trip's, a city's disruptions) one after another, so a removal can't overtake the add before it on the network. */
const inOrder = <T>(key: string, task: () => Promise<T>): Promise<T> => {
    const run = (queues.get(key) ?? Promise.resolve()).then(task, task);
    const settled = run.catch(() => undefined);
    queues.set(key, settled);
    void settled.then(() => { if (queues.get(key) === settled) queues.delete(key); });
    return run;
};

const disruptionQueue = (city: string) => `disruptions:${city}`;

const failure = (error: unknown): RidePushResult =>
    ({ ok: false, reason: error instanceof Error ? `${error.name}: ${error.message}` : String(error) });

const subscribeOptions = (): PushSubscriptionOptionsInit => ({ userVisibleOnly: true, applicationServerKey: applicationServerKey() });

let readyManager: PushManager | null = null;

/** Finds the push manager once the service worker is active, so a tap can subscribe before awaiting anything (`subscribeFromTap`). */
export const preparePush = (): void => {
    void navigator.serviceWorker?.ready.then((registration) => { readyManager = registration.pushManager; }, () => undefined);
};

/**
 * This device's push subscription, asking for notification permission when there is none. Call it first thing in a
 * tap: Safari asks only from the tap itself, so with the push manager prepared it subscribes before any await
 * (`subscribe` answers an existing subscription as is).
 */
const subscribeFromTap = (): Promise<PushSubscription | null> => {
    if (readyManager) return readyManager.subscribe(subscribeOptions());
    return pushManager().then(async manager => (manager ? (await manager.getSubscription()) ?? manager.subscribe(subscribeOptions()) : null));
};

/** This device's existing push subscription, without asking for anything. */
const currentSubscription = async (): Promise<PushSubscription | null> => (await (await pushManager())?.getSubscription()) ?? null;

/** The endpoint of this device's push subscription; null without one or without Web Push. */
export const pushEndpoint = async (): Promise<string | null> => {
    if (typeof PushManager === 'undefined') return null;
    try {
        return (await currentSubscription())?.endpoint ?? null;
    } catch {
        return null;
    }
};

/**
 * The endpoint for keeping the server in step without a tap, renewing a subscription the browser dropped while
 * permission stands. `lost`: notifications are no longer allowed, so nothing can arrive until the user allows them again.
 */
export const backgroundEndpoint = async (): Promise<{ endpoint: string | null; lost: boolean }> => {
    if (typeof PushManager === 'undefined') return { endpoint: null, lost: false };
    try {
        const manager = await pushManager();
        if (!manager) return { endpoint: null, lost: false };
        const existing = await manager.getSubscription();
        if (existing) return { endpoint: existing.endpoint, lost: false };
        if (Notification.permission !== 'granted') return { endpoint: null, lost: true };
        return { endpoint: (await manager.subscribe(subscribeOptions())).endpoint, lost: false };
    } catch (error) {
        return { endpoint: null, lost: error instanceof Error && error.name === 'NotAllowedError' };
    }
};

/** Subscribes this device to push, asking for notification permission when needed; must run from a tap. */
export const subscribePush = async (): Promise<RidePushResult> => {
    if (typeof PushManager === 'undefined') return { ok: false, reason: 'unsupported' };
    try {
        return (await subscribeFromTap()) ? { ok: true } : { ok: false, reason: 'No service worker is registered' };
    } catch (error) {
        return failure(error);
    }
};

/**
 * Subscribes to push and asks the server to push this trip's alerts: before it leaves the user's stop (a boarding
 * stop with a lead) and before their exit (unless ridden to its end). Replaces the device's earlier registration on
 * the trip, starting afresh. Must run from a tap: iOS only lets `subscribe` ask for notification permission there.
 */
export const startTripPush = (trip: MyTrip, texts: TripPushTexts, path: string): Promise<RidePushResult> => {
    if (typeof PushManager === 'undefined') return Promise.resolve({ ok: false, reason: 'unsupported' });
    // Subscribing starts from the tap, and the trip's queue place is taken now, so an end right after waits for this save.
    const subscribing = subscribeFromTap();
    return inOrder(trip.tripId, async (): Promise<RidePushResult> => {
        const subscription = await subscribing;
        if (!subscription) return { ok: false, reason: 'No service worker is registered' };
        await postPush(trip.city, 'ride', {
            action: 'add', tripId: trip.tripId, exitSequence: trip.toEnd ? null : trip.exitSequence,
            board: watchFrom(trip), subscription: subscription.toJSON(), texts, path,
        });
        return { ok: true };
    }).catch(failure);
};


/** Closes a ride's notifications still in the notification centre, e.g. a "next stop" kept until dismissed. */
export const closeRideNotifications = async (tag: string): Promise<void> => {
    try {
        const registration = await navigator.serviceWorker?.getRegistration();
        for (const notification of (await registration?.getNotifications({ tag })) ?? []) notification.close();
    } catch {
        // Nothing to close where notifications aren't supported.
    }
};

/** Stops the server pushing a trip's alerts; false when the removal didn't reach it, so it can be sent again. */
export const stopTripPush = (trip: Pick<MyTrip, 'city' | 'tripId'>): Promise<boolean> => inOrder(trip.tripId, async () => {
    try {
        const subscription = await currentSubscription();
        if (subscription) await postPush(trip.city, 'ride', { action: 'remove', tripId: trip.tripId, endpoint: subscription.endpoint });
        return true;
    } catch {
        return false;
    }
});

/**
 * Asks the server to push new disruptions on these pinned lines of `city`, replacing the device's earlier lines there.
 * With `prompt` it subscribes and may ask for notification permission (it must then run from a tap); without, it
 * only renews an existing subscription and fails when there is none.
 */
export const startDisruptionPush = async (city: string, lines: WatchedLine[], title: string, path: string, prompt: boolean): Promise<RidePushResult> => {
    if (typeof PushManager === 'undefined') return { ok: false, reason: 'unsupported' };
    // Subscribing starts from the tap; the city's queue then keeps this add and a removal in the order they were asked.
    const subscribing = prompt ? subscribeFromTap() : currentSubscription();
    return inOrder(disruptionQueue(city), async (): Promise<RidePushResult> => {
        const subscription = await subscribing;
        if (!subscription) return { ok: false, reason: 'No push subscription' };
        await postPush(city, 'disruptions', { action: 'add', subscription: subscription.toJSON(), lines, title, path });
        return { ok: true };
    }).catch((error: unknown) => ((error as Partial<AppError> | null)?.status === 429 ? { ok: false, reason: 'tooMany' } : failure(error)));
};

/** Stops the server pushing disruptions of `city` to this device; false when the removal didn't reach it. */
export const stopDisruptionPush = (city: string): Promise<boolean> => inOrder(disruptionQueue(city), async () => {
    try {
        const subscription = await currentSubscription();
        if (subscription) await postPush(city, 'disruptions', { action: 'remove', endpoint: subscription.endpoint });
        return true;
    } catch {
        return false;
    }
});

/** Sets the number on the installed app's icon; 0 clears it. Silently nothing where the Badging API is missing. */
export const setAppBadge = async (count: number): Promise<void> => {
    try {
        if (count > 0) await navigator.setAppBadge?.(count);
        else await navigator.clearAppBadge?.();
    } catch {
        // Refused without notification permission, or outside an installed app.
    }
};
