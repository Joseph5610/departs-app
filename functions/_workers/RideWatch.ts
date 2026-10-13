import { DurableObject } from 'cloudflare:workers';
import { RIDE_PUSH } from '../_core/config';
import { sendPush, type PushTarget, type VapidKeys } from '../_core/push/webPush';
import type { AppVehicleDetail } from '../_core/types';
import { isNearExit, liveStopSequence, rideAlertFor, type RideAlert } from '../_domain/rides/rideAlert';

export interface RidePushEnv {
    /** The departs.app origin whose `/api` answers vehicle details (a `[vars]` entry, overridden for local dev). */
    API_ORIGIN: string;
    VAPID_PUBLIC_KEY: string | undefined;
    VAPID_PRIVATE_KEY: string | undefined;
}

export interface RideTrip {
    city: string;
    tripId: string;
    vehicleId: string | null;
}

/** The notification a rider gets for each alert, already in their language. */
export type RideTexts = Record<RideAlert, { title: string; body: string }>;

export interface Rider {
    subscription: PushTarget;
    exitSequence: number;
    texts: RideTexts;
    /** The app page the notification opens: the ride's trip, on the origin the rider registered from. */
    navigate: string;
    alerted: RideAlert[];
    expiresAt: number;
}

/**
 * `add` adds or replaces a device's rider, `remove` drops it only while it still has that exit, so the removal of a
 * replaced ride can't drop the new one. Both come from `/api/[city]/ride`, which validated them.
 */
export type RideWatchRequest =
    | { action: 'add'; trip: RideTrip; rider: Omit<Rider, 'alerted' | 'expiresAt'> }
    | { action: 'remove'; endpoint: string; exitSequence: number };

/**
 * A Declarative Web Push message (WebKit, iOS/macOS 18.4+): Safari shows it without running the service worker;
 * other browsers hand the same JSON to `push-sw.js`.
 */
const ridePayload = (rider: Rider, alert: RideAlert): string => JSON.stringify({
    web_push: 8030,
    notification: { ...rider.texts[alert], navigate: rider.navigate, tag: 'ride-own' },
});

const RIDER_PREFIX = 'rider:';
const riderKey = (endpoint: string) => `${RIDER_PREFIX}${endpoint}`;

/**
 * One trip's riders: an alarm re-reads the trip's live detail from our own `/api`, pushes each rider's `next` and `arrived`
 * once, and sleeps longer while nobody is near their exit. With no riders left it stops and forgets the trip.
 */
export class RideWatch extends DurableObject<RidePushEnv> {
    async fetch(request: Request): Promise<Response> {
        const command = await request.json<RideWatchRequest>();
        const storage = this.ctx.storage;
        if (command.action === 'add') {
            const key = riderKey(command.rider.subscription.endpoint);
            const riders = await storage.list({ prefix: RIDER_PREFIX });
            if (riders.size >= RIDE_PUSH.MAX_RIDERS && !riders.has(key)) return new Response(null, { status: 429 });
            if (!(await storage.get('trip'))) await storage.put('trip', command.trip);
            await storage.put<Rider>(key, {
                ...command.rider,
                alerted: [],
                expiresAt: Date.now() + RIDE_PUSH.MAX_AGE_MS,
            });
            // At most one detail read per near interval, however often riders are added.
            const soonest = Math.max(Date.now(), ((await storage.get<number>('ranAt')) ?? 0) + RIDE_PUSH.NEAR_INTERVAL_S * 1000);
            const alarm = await storage.getAlarm();
            if (alarm === null || alarm > soonest) await storage.setAlarm(soonest);
        } else {
            const key = riderKey(command.endpoint);
            if ((await storage.get<Rider>(key))?.exitSequence === command.exitSequence) await storage.delete(key);
        }
        return new Response(null, { status: 204 });
    }

    async alarm(): Promise<void> {
        const storage = this.ctx.storage;
        const now = Date.now();
        const trip = await storage.get<RideTrip>('trip');
        const riders = await storage.list<Rider>({ prefix: RIDER_PREFIX });
        for (const [key, rider] of riders) if (rider.expiresAt < now) riders.delete(key);
        if (!trip || riders.size === 0) return storage.deleteAll();
        await storage.put('ranAt', now);

        const vapid = this.vapid();
        if (!vapid) {
            console.error('VAPID keys are not configured; ride pushes are off.');
            return storage.deleteAll();
        }

        const url = new URL(`/api/${trip.city}/vehicle-detail`, this.env.API_ORIGIN);
        url.searchParams.set('tripId', trip.tripId);
        if (trip.vehicleId) url.searchParams.set('vehicleId', trip.vehicleId);
        let detail: AppVehicleDetail;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            detail = await response.json<AppVehicleDetail>();
        } catch (error) {
            console.error('Ride detail failed', trip.city, trip.tripId, error);
            const failures = ((await storage.get<number>('failures')) ?? 0) + 1;
            const seen = (await storage.get<boolean>('seen')) ?? false;
            if (failures >= (seen ? RIDE_PUSH.MAX_FAILURES : RIDE_PUSH.MAX_FAILURES_UNSEEN)) return storage.deleteAll();
            await storage.put('failures', failures);
            await storage.setAlarm(now + RIDE_PUSH.RETRY_INTERVAL_S * 1000);
            return;
        }
        await storage.delete('failures');
        await storage.put('seen', true);

        if (liveStopSequence(detail) !== null) await storage.put('liveAt', now);
        else if (now - ((await storage.get<number>('liveAt')) ?? now) > RIDE_PUSH.LOST_MS) return storage.deleteAll();

        let near = false;
        for (const [key, rider] of riders) {
            const alert = rideAlertFor(detail, rider.exitSequence, rider.alerted);
            if (alert) {
                // One broken subscription must not stop the trip's other riders.
                const status = await sendPush(rider.subscription, ridePayload(rider, alert), vapid, Math.floor(now / 1000)).catch((error: unknown) => {
                    console.error('Push failed', trip.tripId, error);
                    return 0;
                });
                console.log(JSON.stringify({ push: alert, trip: trip.tripId, status }));
                if (alert === 'arrived' || status === 0 || status === 404 || status === 410) {
                    riders.delete(key);
                    await storage.delete(key);
                    continue;
                }
                rider.alerted.push(alert);
                await storage.put(key, rider);
            }
            near ||= isNearExit(detail, rider.exitSequence);
        }

        if (riders.size === 0) return storage.deleteAll();
        await storage.setAlarm(now + (near ? RIDE_PUSH.NEAR_INTERVAL_S : RIDE_PUSH.FAR_INTERVAL_S) * 1000);
    }

    private vapid(): VapidKeys | null {
        const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey } = this.env;
        return publicKey && privateKey ? { publicKey, privateKey, subject: RIDE_PUSH.VAPID_SUBJECT } : null;
    }
}
