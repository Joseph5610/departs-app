import { DurableObject } from 'cloudflare:workers';
import { RIDE_PUSH } from '../_core/config';
import { sendPush, type PushTarget, type VapidKeys } from '../_core/push/webPush';
import type { AppVehicleDetail } from '../_core/types';
import { minutesUntilDeparture } from '../_domain/rides/departureAlert';
import { currentStop, observe } from '../_domain/rides/observation';
import { firstCheckAt, initialPhase, isWatchingExit, riderStep, timingOf, type RiderPhase, type TripAlert, type WatchBoard } from '../_domain/rides/tripWatch';

export interface RidePushEnv {
    /** The departs.app origin whose `/api` answers vehicle details (a `[vars]` entry, overridden for local dev). */
    API_ORIGIN: string;
    VAPID_PUBLIC_KEY: string | undefined;
    VAPID_PRIVATE_KEY: string | undefined;
}

/** The trip watched; its detail is read by trip alone, the API finds the vehicle running it. */
export interface RideTrip {
    city: string;
    tripId: string;
}

/** The notification a rider gets for each alert they asked for, already in their language; `soon` carries `MINUTES_TOKEN`. */
export type RideTexts = Partial<Record<TripAlert, { title: string; body: string }>>;

export interface Rider {
    subscription: PushTarget;
    /** Null: no exit alert (a trip ridden to its end). */
    exitSequence: number | null;
    board: WatchBoard | null;
    texts: RideTexts;
    /** The app page the notification opens: the trip, on the origin the rider registered from. */
    navigate: string;
    phase: RiderPhase;
    /** When this registration was stored, so an alarm can tell the rider was replaced while it ran. */
    registeredAt: number;
    expiresAt: number;
}

/** `add` adds or replaces a device's rider, starting afresh; `remove` drops it. Both come from `/api/[city]/ride`, which validated them. */
export type RideWatchRequest =
    | { action: 'add'; trip: RideTrip; rider: Omit<Rider, 'phase' | 'registeredAt' | 'expiresAt'> }
    | { action: 'remove'; endpoint: string };

/**
 * A Declarative Web Push message (WebKit, iOS/macOS 18.4+): Safari shows it without running the service worker;
 * other browsers hand the same JSON to `push-sw.js`. Tagged per trip, so one trip's alerts replace each other only.
 */
const ridePayload = (rider: Rider, alert: TripAlert, tripId: string, minutes: number): string | null => {
    const text = rider.texts[alert];
    if (!text) return null;
    const fill = (value: string) => value.replaceAll(RIDE_PUSH.MINUTES_TOKEN, String(minutes));
    const tag = alert === 'soon' || alert === 'cancelled' ? RIDE_PUSH.BOARD_TAG : RIDE_PUSH.TAG;
    return JSON.stringify({
        web_push: 8030,
        notification: { title: fill(text.title), body: fill(text.body), ...RIDE_PUSH.ALERT_OPTIONS[alert], navigate: rider.navigate, tag: `${tag}:${tripId}` },
    });
};

/** A rider's phase; one registered before 0.88 is aboard, with `next` sent or not. Drop with the legacy key in `ride.ts`. */
const phaseOf = (rider: Rider & { alerted?: string[] }): RiderPhase => rider.phase ?? (rider.alerted?.includes('next') ? 'near' : 'ride');

const RIDER_PREFIX = 'rider:';
const riderKey = (endpoint: string) => `${RIDER_PREFIX}${endpoint}`;

/** A rider is dropped `MAX_AGE_MS` after their departure, or after registering when already aboard. */
const expiryOf = (rider: Pick<Rider, 'board'>, now: number): number => Math.max(now, rider.board?.scheduledMs ?? 0) + RIDE_PUSH.MAX_AGE_MS;

/**
 * One trip's riders, every device on it: an alarm reads the trip's detail from our own `/api` and pushes each rider's
 * boarding alert (`soon`, or `cancelled`) once inside its lead, then `next` and `arrived` before their exit, and sleeps
 * until the soonest rider needs another look. Without a detail the boarding alerts still go on the timetable; failed
 * reads back off. With no riders left it stops and forgets the trip.
 */
export class RideWatch extends DurableObject<RidePushEnv> {
    async fetch(request: Request): Promise<Response> {
        const command = await request.json<RideWatchRequest>();
        const storage = this.ctx.storage;
        const now = Date.now();
        if (command.action === 'remove') {
            await storage.delete(riderKey(command.endpoint));
            return new Response(null, { status: 204 });
        }

        const key = riderKey(command.rider.subscription.endpoint);
        const riders = await storage.list({ prefix: RIDER_PREFIX });
        if (riders.size >= RIDE_PUSH.MAX_RIDERS && !riders.has(key)) return new Response(null, { status: 429 });
        const trip = await storage.get<RideTrip>('trip');
        if (!trip) await storage.put<RideTrip>('trip', command.trip);
        const phase = initialPhase(command.rider);
        await storage.put<Rider>(key, { ...command.rider, phase, registeredAt: now, expiresAt: expiryOf(command.rider, now) });
        // However often riders are added, the trip is read at most once per near interval.
        const lastRun = (await storage.get<number>('ranAt')) ?? 0;
        const due = Math.max(firstCheckAt({ ...command.rider, phase }, now), lastRun + RIDE_PUSH.NEAR_INTERVAL_S * 1000);
        const alarm = await storage.getAlarm();
        if (alarm === null || alarm > due) await storage.setAlarm(due);
        return new Response(null, { status: 204 });
    }

    async alarm(): Promise<void> {
        const storage = this.ctx.storage;
        const now = Date.now();
        const trip = await storage.get<RideTrip>('trip');
        const riders = await storage.list<Rider>({ prefix: RIDER_PREFIX });
        for (const [key, rider] of riders) {
            if (rider.expiresAt >= now) continue;
            riders.delete(key);
            await storage.delete(key);
        }
        if (!trip || riders.size === 0) return this.finish();
        await storage.put('ranAt', now);

        const vapid = this.vapid();
        if (!vapid) {
            console.error('VAPID keys are not configured; ride pushes are off.');
            return storage.deleteAll();
        }

        const observation = observe(await this.readDetail(trip));
        const isFailed = observation.kind === 'failed';
        const failures = isFailed ? ((await storage.get<number>('failures')) ?? 0) + 1 : 0;
        await storage.put('failures', failures);
        if (!isFailed) await storage.put('seen', true);
        if (currentStop(observation) !== null) await storage.put('liveAt', now);
        const liveAt = await storage.get<number>('liveAt');
        // A vehicle that was live and vanished (it finished, or left the feed) ends the exit watches of those aboard.
        const isLost = liveAt !== undefined && now - liveAt > RIDE_PUSH.LOST_MS && currentStop(observation) === null;
        // "Unseen" is a trip whose detail never answered at all, not one still on its timetable before going live.
        const isGivenUp = failures >= ((await storage.get<boolean>('seen')) ? RIDE_PUSH.MAX_FAILURES : RIDE_PUSH.MAX_FAILURES_UNSEEN);
        const backoffAt = now + Math.min(RIDE_PUSH.RETRY_INTERVAL_S * 2 ** Math.min(Math.max(failures - 1, 0), 4), RIDE_PUSH.MAX_RETRY_INTERVAL_S) * 1000;

        let next = Number.POSITIVE_INFINITY;
        for (const [key, rider] of riders) {
            const step = riderStep({ ...rider, phase: phaseOf(rider) }, observation, now);
            let isGone = false;
            for (const alert of step.send) {
                const minutes = rider.board ? minutesUntilDeparture(observation, timingOf(rider.board), now) : 0;
                const payload = ridePayload(rider, alert, trip.tripId, minutes);
                if (!payload) continue;
                // One broken subscription must not stop the trip's other riders.
                const status = await sendPush(rider.subscription, payload, vapid, Math.floor(now / 1000)).catch((error: unknown) => {
                    console.error('Push failed', trip.tripId, error);
                    return 0;
                });
                console.log(JSON.stringify({ push: alert, trip: trip.tripId, status }));
                if (status === 0 || status === 404 || status === 410) isGone = true;
            }
            // A trip that keeps failing (or was never found) is given up for everyone; a vanished vehicle ends the exit watches.
            const isStranded = isGivenUp || (isWatchingExit(step.phase) && isLost);
            const stored = await storage.get<Rider>(key);
            if (!stored) continue;
            // Replaced by the device meanwhile: the new registration keeps its own phase and schedule.
            if (stored.registeredAt !== rider.registeredAt) continue;
            if (step.phase === 'done' || isGone || isStranded) await storage.delete(key);
            else {
                if (step.phase !== rider.phase) await storage.put<Rider>(key, { ...stored, phase: step.phase });
                // After a failed read everyone retries later each time, so a failing trip reaches `isGivenUp` in about an hour.
                const at = isFailed && step.nextAt !== null ? Math.max(step.nextAt, backoffAt) : step.nextAt;
                if (at !== null) next = Math.min(next, at);
            }
        }
        await this.finish(next);
    }

    /**
     * Sleeps until `next`, or sooner when a rider added while this alarm ran asked for it; forgets the trip once no rider
     * is left, read afresh, as one may have registered meanwhile.
     */
    private async finish(next = Number.POSITIVE_INFINITY): Promise<void> {
        const storage = this.ctx.storage;
        const riders = await storage.list<Rider>({ prefix: RIDER_PREFIX });
        if (riders.size === 0) return storage.deleteAll();
        const now = Date.now();
        const pending = await storage.getAlarm();
        let due = Number.isFinite(next) ? next : now + RIDE_PUSH.FAR_INTERVAL_S * 1000;
        if (pending !== null && pending > now) due = Math.min(due, pending);
        await storage.setAlarm(Math.max(due, now));
    }

    /** The trip's detail, or null when it can't be read (or the API knows no such trip). */
    private async readDetail(trip: RideTrip): Promise<AppVehicleDetail | null> {
        const url = new URL(`/api/${trip.city}/vehicle-detail`, this.env.API_ORIGIN);
        url.searchParams.set('tripId', trip.tripId);
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json<AppVehicleDetail>();
        } catch (error) {
            console.error('Ride detail failed', trip.city, trip.tripId, error);
            return null;
        }
    }

    private vapid(): VapidKeys | null {
        const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey } = this.env;
        return publicKey && privateKey ? { publicKey, privateKey, subject: RIDE_PUSH.VAPID_SUBJECT } : null;
    }
}
