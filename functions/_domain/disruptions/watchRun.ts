import { DISRUPTION_PROTOCOL, alertPhase, type WatchedLine } from '../../../shared/alerts';
import { DISRUPTION_PUSH } from '../../_core/config';
import { declarativePush, type PushTarget } from '../../_core/push/webPush';
import type { AppAlert } from '../../_core/types';

export interface Subscriber {
    subscription: PushTarget;
    lines: WatchedLine[];
    /** The notification title in the device's language, carrying `DISRUPTION_PROTOCOL.LINES_TOKEN`. */
    title: string;
    /** The app page the notification opens. */
    navigate: string;
    registeredAt: number;
    expiresAt: number;
}

/**
 * `add` adds or replaces a device's subscription, `ip` (the caller's address, never stored) counting it against the
 * daily quota when it is new; `remove` drops it. Both come from `/api/[city]/disruptions`, which validated them.
 */
export type DisruptionWatchRequest =
    | { action: 'add'; city: string; ip: string | null; subscriber: Omit<Subscriber, 'registeredAt' | 'expiresAt'> }
    | { action: 'remove'; endpoint: string };

/** The part of a Durable Object's storage a disruption watch uses. */
export interface DisruptionStorage {
    get<T>(key: string): Promise<T | undefined>;
    put<T>(key: string, value: T): Promise<void>;
    delete(key: string): Promise<boolean>;
    delete(keys: string[]): Promise<number>;
    list<T>(options: { prefix: string; startAfter?: string; limit?: number }): Promise<Map<string, T>>;
    deleteAll(): Promise<void>;
    getAlarm(): Promise<number | null>;
    setAlarm(scheduledTime: number): Promise<void>;
}

/** The city's alerts (null when the read failed) and a push, answering the push service's status (0: it threw). */
export interface DisruptionPorts {
    readAlerts: (city: string) => Promise<AppAlert[] | null>;
    push: (subscription: PushTarget, payload: string) => Promise<number>;
}

/** A newly current incident, as much of it as its pushes need. */
interface FreshIncident {
    key: string;
    guid: string | null;
    title: string;
    lines: string[];
}

/** Pushes still owed for the incidents of one read: the subscribers after `after` haven't been reached yet. */
interface Fanout {
    fresh: FreshIncident[];
    /** The upper-cased lines of every current incident, for the badge. */
    current: string[][];
    after: string | null;
}

interface Push {
    key: string;
    subscription: PushTarget;
    payload: string;
}

const SUB_PREFIX = 'sub:';
const QUOTA_PREFIX = 'ip';
const COUNT_KEY = 'count';
const NEWEST_KEY = 'newest';
const FANOUT_KEY = 'fanout';
const subKey = (endpoint: string) => `${SUB_PREFIX}${endpoint}`;
const dayOf = (now: number) => Math.floor(now / 86_400_000);

const subscriberCount = async (storage: DisruptionStorage) => (await storage.get<number>(COUNT_KEY)) ?? 0;

/** Deletes subscribers, keeping the stored count in step so the cap never needs the whole list. */
const dropSubscribers = async (storage: DisruptionStorage, keys: string[]) => {
    if (keys.length === 0) return;
    const dropped = await storage.delete(keys);
    if (dropped === 0) return;
    await storage.put(COUNT_KEY, Math.max(0, (await subscriberCount(storage)) - dropped));
    const newest = await storage.get<string>(NEWEST_KEY);
    if (newest && keys.includes(newest)) await storage.delete(NEWEST_KEY);
};

/** What the daily quota counts by: an IPv4 address, or an IPv6 address's /64, since one network holds a whole /64 to rotate through. */
export const quotaBucket = (ip: string): string => {
    if (!ip.includes(':') || ip.includes('.')) return ip;
    const [head] = ip.toLowerCase().split('::');
    const groups = head.split(':').filter(Boolean).map(group => group.replace(/^0+(?=.)/, ''));
    return [...groups, '0', '0', '0', '0'].slice(0, 4).join(':');
};

/** Today's quota key for a bucket: a hash under a salt drawn per day, so once the day's keys are swept it names no address. */
const quotaKey = async (storage: DisruptionStorage, bucket: string, now: number): Promise<string> => {
    const day = dayOf(now);
    const saltKey = `${QUOTA_PREFIX}Salt:${day}`;
    let salt = await storage.get<string>(saltKey);
    if (!salt) {
        salt = [...crypto.getRandomValues(new Uint8Array(16))].map(byte => byte.toString(16).padStart(2, '0')).join('');
        await storage.put(saltKey, salt);
    }
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}${bucket}`)));
    return `${QUOTA_PREFIX}:${day}:${[...digest.slice(0, 16)].map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
};

/** An alert's identity across reads; RSS items without a guid by title and start. */
export const alertKey = (alert: AppAlert): string => alert.guid ?? `${alert.title}|${alert.valid_from ?? ''}`;

/** The incidents that are disruptions now (not upcoming, ended or stale leftovers). */
export const currentIncidents = (alerts: readonly AppAlert[], now: number): AppAlert[] =>
    alerts.filter(alert => alert.type === 'incident' && alertPhase(alert, now) === 'current');

/** The lines an alert lists, upper-cased as the subscribers' keys are compared. */
export const alertLines = (alert: AppAlert): string[] => (alert.lines ?? []).map(line => line.toUpperCase());

/** The subscriber's lines an alert naming `named` touches, in their pinned order. */
export const matchedLines = (lines: readonly WatchedLine[], named: ReadonlySet<string>): string[] =>
    named.size === 0 ? [] : lines.filter(line => line.keys.some(key => named.has(key.toUpperCase()))).map(line => line.name);

/** How many current incidents touch the subscriber's lines: the number on the app icon. */
export const badgeCount = (lines: readonly WatchedLine[], incidents: readonly ReadonlySet<string>[]): number =>
    incidents.filter(named => matchedLines(lines, named).length > 0).length;

/** An incident's push; a tap opens the alert itself when it has a guid. */
const disruptionPayload = (subscriber: Subscriber, incident: FreshIncident, lineNames: string[], badge: number): string => declarativePush({
    title: subscriber.title.replaceAll(DISRUPTION_PROTOCOL.LINES_TOKEN, lineNames.join(', ')),
    body: incident.title,
    navigate: incident.guid ? `${subscriber.navigate}?${DISRUPTION_PROTOCOL.ALERT_PARAM}=${encodeURIComponent(incident.guid)}` : subscriber.navigate,
    tag: `${DISRUPTION_PROTOCOL.TAG}:${incident.key}`,
}, badge);

/** Handles a validated request; answers the HTTP status (429: this address added its fill of new subscriptions today). */
export const handleRequest = async (storage: DisruptionStorage, command: DisruptionWatchRequest, now: number): Promise<number> => {
    if (command.action === 'remove') {
        await dropSubscribers(storage, [subKey(command.endpoint)]);
        return 204;
    }
    const key = subKey(command.subscriber.subscription.endpoint);
    if (!(await storage.get<Subscriber>(key))) {
        if (command.ip) {
            const quota = await quotaKey(storage, quotaBucket(command.ip), now);
            const added = (await storage.get<number>(quota)) ?? 0;
            if (added >= DISRUPTION_PUSH.NEW_PER_IP_PER_DAY) return 429;
            await storage.put(quota, added + 1);
        }
        // A full city drops its newest subscription: a flood then only churns itself, and devices renewing weekly stay.
        if ((await subscriberCount(storage)) >= DISRUPTION_PUSH.MAX_SUBSCRIBERS) {
            const newest = await storage.get<string>(NEWEST_KEY);
            await dropSubscribers(storage, newest ? [newest] : [...(await storage.list({ prefix: SUB_PREFIX, limit: 1 })).keys()]);
        }
        await storage.put(COUNT_KEY, (await subscriberCount(storage)) + 1);
        await storage.put(NEWEST_KEY, key);
    }
    if (!(await storage.get<string>('city'))) await storage.put('city', command.city);
    await storage.put<Subscriber>(key, { ...command.subscriber, registeredAt: now, expiresAt: now + DISRUPTION_PUSH.SUBSCRIBER_MAX_AGE_MS });
    // A fresh watch reads the alerts at once, so what is already running counts as seen before anyone is pushed.
    if ((await storage.getAlarm()) === null) await storage.setAlarm(now);
    return 204;
};

/** Once a day: drops lapsed subscriptions and the quota keys (and salts) of earlier days. */
const sweep = async (storage: DisruptionStorage, now: number) => {
    const lapsed = [...await storage.list<Subscriber>({ prefix: SUB_PREFIX })].filter(([, subscriber]) => subscriber.expiresAt < now).map(([key]) => key);
    for (let i = 0; i < lapsed.length; i += DISRUPTION_PUSH.DELETE_BATCH) await dropSubscribers(storage, lapsed.slice(i, i + DISRUPTION_PUSH.DELETE_BATCH));
    const today = String(dayOf(now));
    const stale = [...(await storage.list({ prefix: QUOTA_PREFIX })).keys()].filter(key => key.split(':')[1] !== today);
    for (let i = 0; i < stale.length; i += DISRUPTION_PUSH.DELETE_BATCH) await storage.delete(stale.slice(i, i + DISRUPTION_PUSH.DELETE_BATCH));
    await storage.put('sweptAt', now);
};

/**
 * One alarm of a city's watch. While a fan-out is under way it sends its next batch; otherwise it reads the alerts
 * and starts one for the newly current incidents, sending what fits this run. The first read only marks what runs as
 * seen. Lapsed subscriptions are swept once a day; with no subscriber left it forgets the city.
 */
export const runAlarm = async (storage: DisruptionStorage, ports: DisruptionPorts, now: number): Promise<void> => {
    const city = await storage.get<string>('city');
    if (now - ((await storage.get<number>('sweptAt')) ?? 0) >= DISRUPTION_PUSH.SWEEP_INTERVAL_MS) await sweep(storage, now);
    if (!city || (await storage.list({ prefix: SUB_PREFIX, limit: 1 })).size === 0) return storage.deleteAll();

    let budget = DISRUPTION_PUSH.PUSHES_PER_RUN;
    const stored = await storage.get<Fanout>(FANOUT_KEY);
    let fanout = stored ?? null;
    if (!fanout) {
        const alerts = await ports.readAlerts(city);
        budget -= 1;
        fanout = alerts ? await freshFanout(storage, alerts, now) : null;
    }
    let hasMore = false;
    if (fanout) {
        const batch = await nextBatch(storage, fanout, budget, now);
        hasMore = batch.after !== null;
        if (hasMore) await storage.put<Fanout>(FANOUT_KEY, { ...fanout, after: batch.after });
        else if (stored) await storage.delete(FANOUT_KEY);
        await sendAll(storage, ports, batch.pushes);
    }
    await storage.setAlarm(now + (hasMore ? DISRUPTION_PUSH.QUEUE_INTERVAL_S : DISRUPTION_PUSH.POLL_INTERVAL_S) * 1000);
};

/** The fan-out the newly current incidents start, recording what runs as seen; writes only when that changed. */
const freshFanout = async (storage: DisruptionStorage, alerts: AppAlert[], now: number): Promise<Fanout | null> => {
    const incidents = currentIncidents(alerts, now);
    const stored = await storage.get<Record<string, number>>('seen');
    const seen = stored ?? {};
    const fresh: FreshIncident[] = [];
    let isChanged = stored === undefined;
    for (const alert of incidents) {
        const key = alertKey(alert);
        if (!(key in seen)) fresh.push({ key, guid: alert.guid ?? null, title: alert.title, lines: alertLines(alert) });
        if (key in seen && now - seen[key] < DISRUPTION_PUSH.SEEN_REFRESH_MS) continue;
        seen[key] = now;
        isChanged = true;
    }
    for (const key in seen) {
        if (now - seen[key] <= DISRUPTION_PUSH.SEEN_TTL_MS) continue;
        delete seen[key];
        isChanged = true;
    }
    if (isChanged) await storage.put('seen', seen);
    // The first read after the watch starts only learns what already runs.
    if (stored === undefined || fresh.length === 0) return null;
    return { fresh, current: incidents.map(alertLines), after: null };
};

/**
 * The next subscribers' pushes, at most `budget` of them and `MAX_PUSHES_PER_SUBSCRIBER` each, read live so a
 * subscription removed or replaced meanwhile gets nothing stale. `after` is where the next batch starts; null when done.
 */
const nextBatch = async (storage: DisruptionStorage, fanout: Fanout, budget: number, now: number): Promise<{ pushes: Push[]; after: string | null }> => {
    const fresh = fanout.fresh.map(incident => ({ incident, named: new Set(incident.lines) }));
    const current = fanout.current.map(lines => new Set(lines));
    const page = await storage.list<Subscriber>({ prefix: SUB_PREFIX, startAfter: fanout.after ?? undefined, limit: DISRUPTION_PUSH.FANOUT_PAGE });
    const pushes: Push[] = [];
    let last: string | null = null;
    for (const [key, subscriber] of page) {
        const owed: Push[] = [];
        if (subscriber.expiresAt >= now) {
            for (const { incident, named } of fresh) {
                if (owed.length === DISRUPTION_PUSH.MAX_PUSHES_PER_SUBSCRIBER) break;
                const lineNames = matchedLines(subscriber.lines, named);
                if (lineNames.length > 0) owed.push({ key, subscription: subscriber.subscription, payload: disruptionPayload(subscriber, incident, lineNames, badgeCount(subscriber.lines, current)) });
            }
        }
        if (pushes.length + owed.length > budget) return { pushes, after: last };
        pushes.push(...owed);
        last = key;
    }
    return { pushes, after: page.size === DISRUPTION_PUSH.FANOUT_PAGE ? last : null };
};

/** Sends the pushes a few at a time (a Worker keeps 6 connections open); a subscription the push service calls gone is dropped. */
const sendAll = async (storage: DisruptionStorage, ports: DisruptionPorts, pushes: Push[]): Promise<void> => {
    const gone: string[] = [];
    for (let i = 0; i < pushes.length; i += DISRUPTION_PUSH.PUSH_CONCURRENCY) {
        await Promise.all(pushes.slice(i, i + DISRUPTION_PUSH.PUSH_CONCURRENCY).map(async (push) => {
            const status = await ports.push(push.subscription, push.payload);
            console.log(JSON.stringify({ push: 'disruption', status }));
            if (status === 404 || status === 410) gone.push(push.key);
        }));
    }
    await dropSubscribers(storage, [...new Set(gone)]);
};
