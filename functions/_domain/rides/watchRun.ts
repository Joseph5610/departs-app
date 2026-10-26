import { RIDE_PROTOCOL, tripNotificationTag } from '../../../shared/rides';
import { RIDE_PUSH } from '../../_core/config';
import type { PushTarget } from '../../_core/push/webPush';
import type { AppVehicleDetail } from '../../_core/types';
import { minutesUntilDeparture } from './departureAlert';
import { currentStop, observe } from './observation';
import { firstCheckAt, initialPhase, isWatchingExit, riderStep, timingOf, type RiderPhase, type TripAlert, type WatchBoard } from './tripWatch';

/** The trip watched; its detail is read by trip alone, the API finds the vehicle running it. */
export interface RideTrip {
    city: string;
    tripId: string;
}

/** The notification a rider gets for each alert they asked for, already in their language; `soon` carries `RIDE_PROTOCOL.MINUTES_TOKEN`. */
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
    /** Times the alert now due was refused by the push service for a while. */
    pushRetries?: number;
    expiresAt: number;
}

/** `add` adds or replaces a device's rider, starting afresh; `remove` drops it. Both come from `/api/[city]/ride`, which validated them. */
export type RideWatchRequest =
    | { action: 'add'; trip: RideTrip; rider: Omit<Rider, 'phase' | 'registeredAt' | 'expiresAt'> }
    | { action: 'remove'; endpoint: string };

/** The part of a Durable Object's storage a trip watch uses. */
export interface WatchStorage {
    get<T>(key: string): Promise<T | undefined>;
    put<T>(key: string, value: T): Promise<void>;
    delete(key: string): Promise<boolean>;
    list<T>(options: { prefix: string }): Promise<Map<string, T>>;
    deleteAll(): Promise<void>;
    getAlarm(): Promise<number | null>;
    setAlarm(scheduledTime: number): Promise<void>;
}

/**
 * The watch's outside world: the trip's detail (null when the read failed, `missing` when the API knows no such trip)
 * and a push, answering the push service's status (0: it threw).
 */
export interface WatchPorts {
    readDetail: (trip: RideTrip) => Promise<AppVehicleDetail | null | 'missing'>;
    push: (subscription: PushTarget, payload: string) => Promise<number>;
}

/**
 * A Declarative Web Push message (WebKit, iOS/macOS 18.4+): Safari shows it without running the service worker;
 * other browsers hand the same JSON to `push-sw.js`. Tagged per trip, so one trip's alerts replace each other only.
 */
const ridePayload = (rider: Rider, alert: TripAlert, tripId: string, minutes: number): string | null => {
    const text = rider.texts[alert];
    if (!text) return null;
    const fill = (value: string) => value.replaceAll(RIDE_PROTOCOL.MINUTES_TOKEN, String(minutes));
    const tag = alert === 'soon' || alert === 'cancelled' ? RIDE_PROTOCOL.BOARD_TAG : RIDE_PROTOCOL.EXIT_TAG;
    return JSON.stringify({
        web_push: 8030,
        notification: { title: fill(text.title), body: fill(text.body), ...RIDE_PUSH.ALERT_OPTIONS[alert], navigate: rider.navigate, tag: tripNotificationTag(tag, tripId) },
    });
};

/** A rider's phase; one registered before 0.88 is aboard, with `next` sent or not (gone `MAX_AGE_MS` after that deploy). */
const phaseOf = (rider: Rider & { alerted?: string[] }): RiderPhase => rider.phase ?? (rider.alerted?.includes('next') ? 'near' : 'ride');

const RIDER_PREFIX = 'rider:';
const riderKey = (endpoint: string) => `${RIDER_PREFIX}${endpoint}`;

/** A rider is dropped `MAX_AGE_MS` after their departure, or after registering when already aboard. */
const expiryOf = (rider: Pick<Rider, 'board'>, now: number): number => Math.max(now, rider.board?.scheduledMs ?? 0) + RIDE_PUSH.MAX_AGE_MS;

/** Handles a validated request; answers the HTTP status (429: the trip has its fill of riders). */
export const handleRequest = async (storage: WatchStorage, command: RideWatchRequest, now: number): Promise<number> => {
    if (command.action === 'remove') {
        await storage.delete(riderKey(command.endpoint));
        return 204;
    }
    const key = riderKey(command.rider.subscription.endpoint);
    const riders = await storage.list({ prefix: RIDER_PREFIX });
    if (riders.size >= RIDE_PUSH.MAX_RIDERS && !riders.has(key)) return 429;
    if (!(await storage.get<RideTrip>('trip'))) await storage.put<RideTrip>('trip', command.trip);
    const phase = initialPhase(command.rider);
    await storage.put<Rider>(key, { ...command.rider, phase, registeredAt: now, expiresAt: expiryOf(command.rider, now) });
    // However often riders are added, the trip is read at most once per near interval.
    const lastRun = (await storage.get<number>('ranAt')) ?? 0;
    const due = Math.max(firstCheckAt({ ...command.rider, phase }, now), lastRun + RIDE_PUSH.NEAR_INTERVAL_S * 1000);
    const alarm = await storage.getAlarm();
    if (alarm === null || alarm > due) await storage.setAlarm(due);
    return 204;
};

/**
 * One alarm of a trip's watch: reads the trip's detail and pushes each rider's boarding alert (`soon`, or `cancelled`)
 * once inside its lead, then `next` and `arrived` before their exit, and sleeps until the soonest rider needs another
 * look. Without a detail the boarding alerts still go on the timetable; failed reads back off. With no riders left it
 * forgets the trip.
 */
export const runAlarm = async (storage: WatchStorage, ports: WatchPorts, now: number): Promise<void> => {
    const trip = await storage.get<RideTrip>('trip');
    const riders = await storage.list<Rider>({ prefix: RIDER_PREFIX });
    for (const [key, rider] of riders) {
        if (rider.expiresAt >= now) continue;
        riders.delete(key);
        await storage.delete(key);
    }
    if (!trip || riders.size === 0) return finish(storage, now);
    await storage.put('ranAt', now);

    const read = await ports.readDetail(trip);
    const observation = observe(read === 'missing' ? null : read);
    const isFailed = observation.kind === 'failed';
    const failures = isFailed ? ((await storage.get<number>('failures')) ?? 0) + 1 : 0;
    const missing = read === 'missing' ? ((await storage.get<number>('missing')) ?? 0) + 1 : 0;
    const failingSince = isFailed ? (await storage.get<number>('failingSince')) ?? now : undefined;
    await storage.put('failures', failures);
    await storage.put('missing', missing);
    if (failingSince === undefined) await storage.delete('failingSince');
    else await storage.put('failingSince', failingSince);
    if (!isFailed) await storage.put('seen', true);
    if (currentStop(observation) !== null) await storage.put('liveAt', now);
    const liveAt = await storage.get<number>('liveAt');
    // A vehicle that was live and vanished (it finished, or left the feed) ends the exit watches of those aboard; a failed read is no proof.
    const isLost = !isFailed && liveAt !== undefined && now - liveAt > RIDE_PUSH.LOST_MS && currentStop(observation) === null;
    // Given up after an hour of failing, or at once for a trip the API says doesn't exist and never answered for.
    const isGivenUp = (failingSince !== undefined && now - failingSince >= RIDE_PUSH.GIVE_UP_AFTER_MS)
        || (!(await storage.get<boolean>('seen')) && missing >= RIDE_PUSH.MAX_MISSING_UNSEEN);
    const backoffAt = now + Math.min(RIDE_PUSH.RETRY_INTERVAL_S * 2 ** Math.min(Math.max(failures - 1, 0), 4), RIDE_PUSH.MAX_RETRY_INTERVAL_S) * 1000;

    let next = Number.POSITIVE_INFINITY;
    for (const [key, rider] of riders) {
        const step = riderStep({ ...rider, phase: phaseOf(rider) }, observation, now);
        let outcome: 'sent' | 'gone' | 'refused' | 'replaced' = 'sent';
        for (const alert of step.send) {
            const payload = ridePayload(rider, alert, trip.tripId, rider.board ? minutesUntilDeparture(observation, timingOf(rider.board), now) : 0);
            if (!payload) continue;
            // Removed or replaced by the device while this alarm waited on a read or an earlier push: nothing more for this registration.
            if ((await storage.get<Rider>(key))?.registeredAt !== rider.registeredAt) {
                outcome = 'replaced';
                break;
            }
            const status = await ports.push(rider.subscription, payload);
            console.log(JSON.stringify({ push: alert, trip: trip.tripId, status }));
            if (status >= 200 && status < 300) continue;
            outcome = status === 0 || status === 429 || status >= 500 ? 'refused' : 'gone';
            break;
        }
        // A trip that keeps failing (or was never found) is given up for everyone; a vanished vehicle ends the exit watches.
        const isStranded = isGivenUp || (isWatchingExit(step.phase) && isLost);
        const stored = await storage.get<Rider>(key);
        // Removed, or replaced by the device meanwhile: the new registration keeps its own phase and schedule.
        if (!stored || outcome === 'replaced' || stored.registeredAt !== rider.registeredAt) continue;
        const retries = stored.pushRetries ?? 0;
        // Refused for a while: the phase stays, so the next alarm sends the alert again, a few times at most.
        const isRetried = outcome === 'refused' && retries < RIDE_PUSH.MAX_PUSH_RETRIES;
        if (outcome === 'gone' || isStranded || (step.phase === 'done' && !isRetried)) await storage.delete(key);
        else if (isRetried) {
            await storage.put<Rider>(key, { ...stored, pushRetries: retries + 1 });
            next = Math.min(next, now + RIDE_PUSH.RETRY_INTERVAL_S * 1000);
        } else {
            if (step.phase !== rider.phase || retries > 0) await storage.put<Rider>(key, { ...stored, phase: step.phase, pushRetries: 0 });
            // After a failed read the trip is retried later each time, but never past a boarding alert still to go.
            const at = isFailed && step.phase !== 'remind' && step.nextAt !== null ? Math.max(step.nextAt, backoffAt) : step.nextAt;
            if (at !== null) next = Math.min(next, at);
        }
    }
    await finish(storage, now, next);
};

/**
 * Sleeps until `next`, or sooner when a rider added while the alarm ran asked for it; forgets the trip once no rider
 * is left, read afresh, as one may have registered meanwhile.
 */
const finish = async (storage: WatchStorage, now: number, next = Number.POSITIVE_INFINITY): Promise<void> => {
    const riders = await storage.list<Rider>({ prefix: RIDER_PREFIX });
    if (riders.size === 0) return storage.deleteAll();
    const pending = await storage.getAlarm();
    let due = Number.isFinite(next) ? next : now + RIDE_PUSH.FAR_INTERVAL_S * 1000;
    if (pending !== null && pending > now) due = Math.min(due, pending);
    await storage.setAlarm(Math.max(due, now));
};
