import { DurableObject } from 'cloudflare:workers';
import { RIDE_PUSH } from '../_core/config';
import { sendPush, type PushTarget, type VapidKeys } from '../_core/push/webPush';
import type { AppVehicleDetail } from '../_core/types';
import { minutesUntilDeparture } from '../_domain/rides/departureAlert';
import { liveStopSequence } from '../_domain/rides/rideAlert';
import { carriedAlerts, firstCheckAt, needsLiveDetail, riderStep, type TripAlert, type WatchBoard } from '../_domain/rides/tripWatch';

export interface RidePushEnv {
    /** The departs.app origin whose `/api` answers vehicle details (a `[vars]` entry, overridden for local dev). */
    API_ORIGIN: string;
    VAPID_PUBLIC_KEY: string | undefined;
    VAPID_PRIVATE_KEY: string | undefined;
}

export interface RideTrip {
    city: string;
    tripId: string;
    /** The vehicle running the trip; looked up from the city's fleet when a rider registered before it ran. */
    vehicleId: string | null;
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
    /** Set by the app per save; a removal names it, so one meant for a replaced registration can't drop the new one. Null from an app predating revisions. */
    revision: number | null;
    alerted: TripAlert[];
    expiresAt: number;
}

/**
 * `add` adds or replaces a device's rider, keeping the alerts it already had; `remove` drops it only while it is the
 * registration `revision` names. Both come from `/api/[city]/ride`, which validated them.
 */
export type RideWatchRequest =
    | { action: 'add'; trip: RideTrip; rider: Omit<Rider, 'alerted' | 'expiresAt'> }
    | { action: 'remove'; endpoint: string; revision: number | null };

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
            const key = riderKey(command.endpoint);
            const stored = await storage.get<Rider>(key);
            if (stored && (stored.revision ?? null) === command.revision) await storage.delete(key);
            return new Response(null, { status: 204 });
        }

        const key = riderKey(command.rider.subscription.endpoint);
        const riders = await storage.list({ prefix: RIDER_PREFIX });
        if (riders.size >= RIDE_PUSH.MAX_RIDERS && !riders.has(key)) return new Response(null, { status: 429 });
        const trip = await storage.get<RideTrip>('trip');
        // A device's vehicle id is only a hint, taken while none is known; `readDetail` checks it and drops a wrong one.
        if (!trip || (!trip.vehicleId && command.trip.vehicleId)) await storage.put<RideTrip>('trip', { ...command.trip, vehicleId: trip?.vehicleId ?? command.trip.vehicleId });
        const alerted = carriedAlerts(await storage.get<Rider>(key), command.rider);
        await storage.put<Rider>(key, { ...command.rider, alerted, expiresAt: expiryOf(command.rider, now) });
        // However often riders are added, the trip is read at most once per near interval.
        const lastRun = (await storage.get<number>('ranAt')) ?? 0;
        const due = Math.max(firstCheckAt({ ...command.rider, alerted }, now), lastRun + RIDE_PUSH.NEAR_INTERVAL_S * 1000);
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

        const needsLive = [...riders.values()].some(rider => needsLiveDetail(rider, now));
        const detail = await this.readDetail(trip, needsLive);
        const failures = detail ? 0 : ((await storage.get<number>('failures')) ?? 0) + 1;
        await storage.put('failures', failures);
        if (detail) await storage.put('seen', true);
        if (detail && liveStopSequence(detail) !== null) await storage.put('liveAt', now);
        const liveAt = await storage.get<number>('liveAt');
        // A vehicle that was live and vanished (it finished, or left the feed) ends the exit watches of those aboard.
        const isLost = liveAt !== undefined && now - liveAt > RIDE_PUSH.LOST_MS && (!detail || liveStopSequence(detail) === null);
        // "Unseen" is a trip whose detail never answered at all, not one still on its timetable before going live.
        const isGivenUp = failures >= ((await storage.get<boolean>('seen')) ? RIDE_PUSH.MAX_FAILURES : RIDE_PUSH.MAX_FAILURES_UNSEEN);
        const backoffAt = now + Math.min(RIDE_PUSH.RETRY_INTERVAL_S * 2 ** Math.min(Math.max(failures - 1, 0), 4), RIDE_PUSH.MAX_RETRY_INTERVAL_S) * 1000;

        let next = Number.POSITIVE_INFINITY;
        for (const [key, rider] of riders) {
            const step = riderStep(rider, detail, now);
            for (const alert of step.send) {
                const minutes = minutesUntilDeparture(detail, { boardSequence: rider.board?.sequence ?? 0, scheduledMs: rider.board?.scheduledMs ?? now, leadMin: rider.board?.leadMin ?? 0 }, now);
                const payload = ridePayload(rider, alert, trip.tripId, minutes);
                if (!payload) continue;
                // One broken subscription must not stop the trip's other riders.
                const status = await sendPush(rider.subscription, payload, vapid, Math.floor(now / 1000)).catch((error: unknown) => {
                    console.error('Push failed', trip.tripId, error);
                    return 0;
                });
                console.log(JSON.stringify({ push: alert, trip: trip.tripId, status }));
                if (status === 0 || status === 404 || status === 410) step.done = true;
            }
            // Without a detail an exit can't be watched: a rider still riding to one is dropped once reads keep failing.
            const isStranded = step.watchingExit && (isLost || isGivenUp);
            const stored = await storage.get<Rider>(key);
            if (!stored) continue;
            // Replaced by the device meanwhile: the new registration only learns what was just sent, keeping its own schedule.
            if (stored.revision !== rider.revision) {
                const sent = carriedAlerts({ ...rider, alerted: step.alerted }, stored).filter(a => !stored.alerted.includes(a));
                if (sent.length > 0) await storage.put<Rider>(key, { ...stored, alerted: [...stored.alerted, ...sent] });
                continue;
            }
            if (step.done || isStranded) await storage.delete(key);
            else {
                if (step.alerted.length !== rider.alerted.length) await storage.put<Rider>(key, { ...stored, alerted: step.alerted });
                // After a failed read, only those riding to an exit retry, and later each time; the others keep their own time.
                const at = !detail && step.watchingExit && step.nextAt !== null ? Math.max(step.nextAt, backoffAt) : step.nextAt;
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

    /**
     * The trip's detail, or null when it can't be read. A trip registered before its vehicle ran has no vehicle id, and
     * some networks then answer the timetable only: while a live position matters, its vehicle is looked up in the
     * city's fleet once and kept.
     */
    private async readDetail(trip: RideTrip, needsLive: boolean): Promise<AppVehicleDetail | null> {
        const storage = this.ctx.storage;
        let current = trip;
        let detail = await this.fetchDetail(current);
        // A vehicle id the API doesn't know, or that runs another trip, is wrong (stale, or a device's bad hint): read
        // without it. A failed read is no proof, so the id stays.
        if (current.vehicleId && (detail === 'missing' || (detail && detail.gtfs_trip_id !== current.tripId))) {
            console.log(JSON.stringify({ vehicleDropped: current.vehicleId, trip: current.tripId }));
            current = { ...current, vehicleId: null };
            await storage.put<RideTrip>('trip', current);
            detail = await this.fetchDetail(current);
        }
        if (detail === 'missing') return null;
        if (!detail || !detail.is_static_fallback || !needsLive) return detail;
        // Timetable-only while a live position matters: no vehicle known yet, or a wrong one (some networks then answer
        // the timetable for any id). The fleet says which vehicle runs the trip; looked up at most every few minutes.
        const lookedUpAt = (await storage.get<number>('lookedUpAt')) ?? 0;
        if (Date.now() - lookedUpAt < RIDE_PUSH.VEHICLE_LOOKUP_INTERVAL_MS) return detail;
        await storage.put('lookedUpAt', Date.now());
        const vehicleId = await this.findVehicle(current);
        if (!vehicleId || vehicleId === current.vehicleId) return detail;
        const withVehicle = { ...current, vehicleId };
        await storage.put<RideTrip>('trip', withVehicle);
        console.log(JSON.stringify({ vehicleFound: vehicleId, replaced: current.vehicleId, trip: current.tripId }));
        const live = await this.fetchDetail(withVehicle);
        return live && live !== 'missing' ? live : detail;
    }

    /** The trip's detail; `missing` when the API knows no such trip or vehicle, null when the read failed. */
    private async fetchDetail(trip: RideTrip): Promise<AppVehicleDetail | 'missing' | null> {
        const url = new URL(`/api/${trip.city}/vehicle-detail`, this.env.API_ORIGIN);
        url.searchParams.set('tripId', trip.tripId);
        if (trip.vehicleId) url.searchParams.set('vehicleId', trip.vehicleId);
        try {
            const response = await fetch(url);
            if (response.status === 404) return 'missing';
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json<AppVehicleDetail>();
        } catch (error) {
            console.error('Ride detail failed', trip.city, trip.tripId, error);
            return null;
        }
    }

    /** The vehicle running the trip, from the city's live fleet (edge-cached); null while none does. */
    private async findVehicle(trip: RideTrip): Promise<string | null> {
        try {
            const response = await fetch(new URL(`/api/${trip.city}/vehicles`, this.env.API_ORIGIN));
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const fleet = await response.json<{ features?: { properties: { gtfs_trip_id?: string; vehicle_id?: string | null } }[] }>();
            return fleet.features?.find(f => f.properties.gtfs_trip_id === trip.tripId)?.properties.vehicle_id || null;
        } catch (error) {
            console.error('Fleet lookup failed', trip.city, trip.tripId, error);
            return null;
        }
    }

    private vapid(): VapidKeys | null {
        const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey } = this.env;
        return publicKey && privateKey ? { publicKey, privateKey, subject: RIDE_PUSH.VAPID_SUBJECT } : null;
    }
}
