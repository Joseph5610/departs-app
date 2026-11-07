import { describe, expect, it } from 'vitest';
import { ALERT_RULES, type WatchedLine } from '../../../shared/alerts';
import { DISRUPTION_PUSH } from '../../_core/config';
import type { AppAlert } from '../../_core/types';
import { alertLines, badgeCount, handleRequest, matchedLines, quotaBucket, runAlarm, type DisruptionPorts, type DisruptionStorage } from './watchRun';

const NOW = Date.parse('2026-10-30T12:00:00Z');
const POLL_MS = DISRUPTION_PUSH.POLL_INTERVAL_S * 1000;

/** A Durable Object's storage in memory; values are copied in and out, as the real one serializes them. */
class MemoryStorage implements DisruptionStorage {
    data = new Map<string, unknown>();
    alarm: number | null = null;
    writes = 0;
    async get<T>(key: string) { return structuredClone(this.data.get(key)) as T | undefined; }
    async put<T>(key: string, value: T) { this.writes++; this.data.set(key, structuredClone(value)); }
    delete(key: string): Promise<boolean>;
    delete(keys: string[]): Promise<number>;
    async delete(keys: string | string[]) {
        if (typeof keys === 'string') return this.data.delete(keys);
        return keys.filter(key => this.data.delete(key)).length;
    }
    lists = 0;
    largestList = 0;
    async list<T>({ prefix, startAfter, limit = Infinity }: { prefix: string; startAfter?: string; limit?: number }) {
        this.lists++;
        const entries = [...this.data].filter(([key]) => key.startsWith(prefix) && (startAfter === undefined || key > startAfter)).sort(([a], [b]) => (a < b ? -1 : 1)).slice(0, limit);
        this.largestList = Math.max(this.largestList, entries.length);
        return new Map(entries.map(([key, value]) => [key, structuredClone(value) as T]));
    }
    async deleteAll() { this.data.clear(); this.alarm = null; }
    async getAlarm() { return this.alarm; }
    async setAlarm(at: number) { this.alarm = at; }
}

const incident = (guid: string, lines: string[], overrides: Partial<AppAlert> = {}): AppAlert => ({
    type: 'incident', title: `Alert ${guid}`, description: null, link: '', valid_from: null, valid_to: null, guid, lines, ...overrides,
});

const endpoint = (device: string) => `https://fcm.googleapis.com/fcm/send/${device}`;
const LINE_9: WatchedLine = { name: '9', keys: ['L9', '9'] };
const LINE_22: WatchedLine = { name: '22', keys: ['L22', '22'] };

const subscribe = (storage: MemoryStorage, device: string, lines: WatchedLine[], at = NOW, ip: string | null = null) => handleRequest(storage, {
    action: 'add',
    city: 'prague',
    ip,
    subscriber: { subscription: { endpoint: endpoint(device), keys: { p256dh: 'p', auth: 'a' } }, lines, title: 'Disruption: {lines}', navigate: 'https://departs.app/prague' },
}, at);

interface Pushed { device: string; title: string; body: string; badge: number; navigate: string }

/** Ports answering `alerts` and recording pushes; `status` is the push service's answer. */
const world = (alerts: { current: AppAlert[] | null }, status: (device: string) => number = () => 201) => {
    const pushed: Pushed[] = [];
    const ports: DisruptionPorts = {
        readAlerts: async () => alerts.current,
        push: async (subscription, payload) => {
            const { notification, app_badge } = JSON.parse(payload);
            const device = subscription.endpoint.slice(subscription.endpoint.lastIndexOf('/') + 1);
            pushed.push({ device, title: notification.title, body: notification.body, badge: app_badge, navigate: notification.navigate });
            return status(device);
        },
    };
    return { ports, pushed };
};

describe('matchedLines', () => {
    it('names the pinned lines an alert lists by any of their keys, case-insensitively', () => {
        expect(matchedLines([LINE_9, LINE_22], new Set(alertLines(incident('a', ['l22', 'L5']))))).toEqual(['22']);
        expect(matchedLines([LINE_9, LINE_22], new Set(alertLines(incident('a', []))))).toEqual([]);
    });

    it('counts the incidents touching any pinned line for the badge', () => {
        const incidents = [incident('a', ['L9']), incident('b', ['9', 'L22']), incident('c', ['L5'])].map(alert => new Set(alertLines(alert)));
        expect(badgeCount([LINE_9], incidents)).toBe(2);
    });
});

describe('quotaBucket', () => {
    // One network holds a whole IPv6 /64, so counting full addresses would count nothing.
    it('counts IPv6 by its /64, however the address is written', () => {
        expect(quotaBucket('2001:db8:1:2:aaaa::1')).toBe('2001:db8:1:2');
        expect(quotaBucket('2001:0DB8:0001:0002:bbbb:cccc:dddd:eeee')).toBe('2001:db8:1:2');
        expect(quotaBucket('2001:db8::1')).toBe('2001:db8:0:0');
    });

    it('counts IPv4 by its address', () => {
        expect(quotaBucket('203.0.113.7')).toBe('203.0.113.7');
        expect(quotaBucket('::ffff:203.0.113.7')).toBe('::ffff:203.0.113.7');
    });
});

describe('disruption watch', () => {
    // Subscribing must not flood the device with everything already running.
    it('marks the incidents running at the first read as seen without pushing them', async () => {
        const storage = new MemoryStorage();
        const alerts = { current: [incident('old', ['L9'])] };
        const { ports, pushed } = world(alerts);
        await subscribe(storage, 'd1', [LINE_9]);
        expect(storage.alarm).toBe(NOW);

        await runAlarm(storage, ports, NOW);
        expect(pushed).toEqual([]);
        expect(storage.alarm).toBe(NOW + POLL_MS);
    });

    // The free plan allows 100k row writes a day: a poll that finds nothing new must not spend any.
    it('writes nothing on a poll that finds nothing new', async () => {
        const storage = new MemoryStorage();
        const { ports } = world({ current: [incident('old', ['L9'])] });
        await subscribe(storage, 'd1', [LINE_9]);
        await runAlarm(storage, ports, NOW);
        const writes = storage.writes;
        await runAlarm(storage, ports, NOW + POLL_MS);
        await runAlarm(storage, ports, NOW + 2 * POLL_MS);
        expect(storage.writes).toBe(writes);
    });

    it('sends pushes that fit the run without queueing them', async () => {
        const storage = new MemoryStorage();
        const alerts: { current: AppAlert[] } = { current: [] };
        const { ports, pushed } = world(alerts);
        await subscribe(storage, 'd1', [LINE_9]);
        await runAlarm(storage, ports, NOW);
        alerts.current = [incident('new', ['L9'])];
        const writes = storage.writes;
        await runAlarm(storage, ports, NOW + POLL_MS);
        expect(pushed).toHaveLength(1);
        // Only the seen list records the new incident.
        expect(storage.writes - writes).toBe(1);
    });

    it('pushes a new incident only to subscribers whose lines it names, with their badge count', async () => {
        const storage = new MemoryStorage();
        const alerts = { current: [incident('old', ['L9'])] };
        const { ports, pushed } = world(alerts);
        await subscribe(storage, 'd9', [LINE_9]);
        await subscribe(storage, 'd22', [LINE_22]);
        await runAlarm(storage, ports, NOW);

        alerts.current = [incident('old', ['L9']), incident('new', ['L9', 'L22'])];
        await runAlarm(storage, ports, NOW + POLL_MS);
        alerts.current = [incident('old', ['L9']), incident('new', ['L9', 'L22']), incident('other', ['L5'])];
        await runAlarm(storage, ports, NOW + 2 * POLL_MS);

        expect(pushed).toEqual([
            { device: 'd22', title: 'Disruption: 22', body: 'Alert new', badge: 1, navigate: 'https://departs.app/prague?alert=new' },
            { device: 'd9', title: 'Disruption: 9', body: 'Alert new', badge: 2, navigate: 'https://departs.app/prague?alert=new' },
        ]);
    });

    // Exclusions are planned; an upcoming incident is pushed once it starts; stale leftovers never.
    it('pushes neither exclusions, upcoming nor stale incidents, and an upcoming one once it starts', async () => {
        const storage = new MemoryStorage();
        const alerts: { current: AppAlert[] } = { current: [] };
        const { ports, pushed } = world(alerts);
        await subscribe(storage, 'd1', [LINE_9]);
        await runAlarm(storage, ports, NOW);

        const startsAt = NOW + 2 * POLL_MS;
        alerts.current = [
            incident('planned', ['L9'], { type: 'exclusion' }),
            incident('upcoming', ['L9'], { valid_from: new Date(startsAt).toISOString() }),
            incident('stale', ['L9'], { valid_from: new Date(NOW - ALERT_RULES.INCIDENT_STALE_AFTER_MS - 1).toISOString() }),
        ];
        await runAlarm(storage, ports, NOW + POLL_MS);
        expect(pushed).toEqual([]);

        await runAlarm(storage, ports, startsAt);
        expect(pushed.map(p => p.body)).toEqual(['Alert upcoming']);
    });

    it('does not push an alert without a guid twice', async () => {
        const storage = new MemoryStorage();
        const alerts: { current: AppAlert[] } = { current: [] };
        const { ports, pushed } = world(alerts);
        await subscribe(storage, 'd1', [LINE_9]);
        await runAlarm(storage, ports, NOW);

        alerts.current = [incident('x', ['9'], { guid: undefined })];
        await runAlarm(storage, ports, NOW + POLL_MS);
        await runAlarm(storage, ports, NOW + 2 * POLL_MS);
        expect(pushed).toHaveLength(1);
        // Without a guid there is no alert to open, so the tap opens the city.
        expect(pushed[0].navigate).toBe('https://departs.app/prague');
    });

    it('drops a subscription the push service calls gone, and forgets the city once none is left', async () => {
        const storage = new MemoryStorage();
        const alerts: { current: AppAlert[] } = { current: [] };
        const { ports } = world(alerts, () => 410);
        await subscribe(storage, 'd1', [LINE_9]);
        await runAlarm(storage, ports, NOW);

        alerts.current = [incident('new', ['L9'])];
        await runAlarm(storage, ports, NOW + POLL_MS);
        expect(await storage.list({ prefix: 'sub:' })).toEqual(new Map());

        await runAlarm(storage, ports, NOW + 2 * POLL_MS);
        expect(storage.data.size).toBe(0);
        expect(storage.alarm).toBeNull();
    });

    it('drops a subscription the app has not renewed in time', async () => {
        const storage = new MemoryStorage();
        const { ports } = world({ current: [] });
        await subscribe(storage, 'd1', [LINE_9]);
        await runAlarm(storage, ports, NOW + DISRUPTION_PUSH.SUBSCRIBER_MAX_AGE_MS + 1);
        expect(storage.data.size).toBe(0);
    });

    // A full city's subscriptions together outgrow the object's memory, so the sweep reads them a page at a time.
    it('sweeps lapsed subscriptions page by page', async () => {
        const storage = new MemoryStorage();
        const { ports } = world({ current: [] });
        const devices = DISRUPTION_PUSH.FANOUT_PAGE + 3;
        for (let i = 0; i < devices; i++) await subscribe(storage, `d${i}`, [LINE_9]);
        await subscribe(storage, 'fresh', [LINE_9], NOW + DISRUPTION_PUSH.SUBSCRIBER_MAX_AGE_MS);
        storage.largestList = 0;
        await runAlarm(storage, ports, NOW + DISRUPTION_PUSH.SUBSCRIBER_MAX_AGE_MS + 1);
        expect([...(await storage.list({ prefix: 'sub:' })).keys()]).toHaveLength(1);
        expect(storage.largestList).toBeLessThanOrEqual(DISRUPTION_PUSH.FANOUT_PAGE + 1);
    });

    // Anyone may subscribe: a flood filling the city must churn itself, not lock out or push out established devices.
    it('makes room in a full city by dropping its newest subscription', async () => {
        const storage = new MemoryStorage();
        const last = DISRUPTION_PUSH.MAX_SUBSCRIBERS - 1;
        for (let i = 0; i <= last; i++) await subscribe(storage, `d${String(i).padStart(4, '0')}`, [LINE_9]);
        expect(await subscribe(storage, 'flood1', [LINE_9])).toBe(204);
        expect(await subscribe(storage, 'flood2', [LINE_9])).toBe(204);
        const subscribers = await storage.list({ prefix: 'sub:' });
        expect(subscribers.size).toBe(DISRUPTION_PUSH.MAX_SUBSCRIBERS);
        expect(storage.data.get('count')).toBe(DISRUPTION_PUSH.MAX_SUBSCRIBERS);
        expect(subscribers.has(`sub:${endpoint('flood2')}`)).toBe(true);
        expect(subscribers.has(`sub:${endpoint('flood1')}`)).toBe(false);
        expect(subscribers.has(`sub:${endpoint(`d${last}`)}`)).toBe(false);
        expect(subscribers.has(`sub:${endpoint('d0000')}`)).toBe(true);
    });

    it('refuses an address its new subscriptions past the daily quota, but still lets it renew', async () => {
        const storage = new MemoryStorage();
        for (let i = 0; i < DISRUPTION_PUSH.NEW_PER_IP_PER_DAY; i++) expect(await subscribe(storage, `d${i}`, [LINE_9], NOW, '203.0.113.7')).toBe(204);
        expect(await subscribe(storage, 'one-more', [LINE_9], NOW, '203.0.113.7')).toBe(429);
        expect(await subscribe(storage, 'd0', [LINE_22], NOW, '203.0.113.7')).toBe(204);
        expect(await subscribe(storage, 'elsewhere', [LINE_9], NOW, '198.51.100.1')).toBe(204);
        expect(await subscribe(storage, 'one-more', [LINE_9], NOW + 24 * 3600_000, '203.0.113.7')).toBe(204);
    });

    it('counts a whole IPv6 network against one quota', async () => {
        const storage = new MemoryStorage();
        for (let i = 0; i < DISRUPTION_PUSH.NEW_PER_IP_PER_DAY; i++) expect(await subscribe(storage, `d${i}`, [LINE_9], NOW, `2001:db8:1:2::${i + 1}`)).toBe(204);
        expect(await subscribe(storage, 'rotated', [LINE_9], NOW, '2001:db8:1:2:ffff::1')).toBe(429);
    });

    it('does not keep the address of a withdrawn newest subscription', async () => {
        const storage = new MemoryStorage();
        await subscribe(storage, 'd1', [LINE_9]);
        await handleRequest(storage, { action: 'remove', endpoint: endpoint('d1') }, NOW);
        expect(JSON.stringify([...storage.data])).not.toContain(endpoint('d1'));
    });

    it('keeps no address, and sweeps the quota of earlier days', async () => {
        const storage = new MemoryStorage();
        await subscribe(storage, 'd1', [LINE_9], NOW, '203.0.113.7');
        expect(JSON.stringify([...storage.data])).not.toContain('203.0.113.7');
        const quota = () => [...storage.data.keys()].filter(key => key.startsWith('ip'));
        expect(quota()).toHaveLength(2);
        await runAlarm(storage, world({ current: [] }).ports, NOW + 24 * 3600_000);
        expect(quota()).toEqual([]);
    });

    it('keeps the subscriber count in step through renewals, removals and sweeps', async () => {
        const storage = new MemoryStorage();
        await subscribe(storage, 'd1', [LINE_9]);
        await subscribe(storage, 'd1', [LINE_22]);
        await subscribe(storage, 'd2', [LINE_9]);
        await subscribe(storage, 'd3', [LINE_9], NOW - DISRUPTION_PUSH.SUBSCRIBER_MAX_AGE_MS);
        expect(storage.data.get('count')).toBe(3);
        await handleRequest(storage, { action: 'remove', endpoint: endpoint('d2') }, NOW);
        await handleRequest(storage, { action: 'remove', endpoint: endpoint('d2') }, NOW);
        await runAlarm(storage, world({ current: [] }).ports, NOW + 1);
        expect(storage.data.get('count')).toBe(1);
    });

    it('does not push a lapsed subscription the daily sweep has not reached yet', async () => {
        const storage = new MemoryStorage();
        const alerts: { current: AppAlert[] } = { current: [] };
        const { ports, pushed } = world(alerts);
        const lapsesAt = NOW + DISRUPTION_PUSH.SUBSCRIBER_MAX_AGE_MS;
        await subscribe(storage, 'old', [LINE_9]);
        await subscribe(storage, 'fresh', [LINE_9], lapsesAt - DISRUPTION_PUSH.SWEEP_INTERVAL_MS / 2);
        await runAlarm(storage, ports, lapsesAt - DISRUPTION_PUSH.SWEEP_INTERVAL_MS / 2);

        alerts.current = [incident('new', ['L9'])];
        await runAlarm(storage, ports, lapsesAt + 1);
        expect(pushed.map(p => p.device)).toEqual(['fresh']);
    });

    // The free plan caps subrequests per run, so a big fan-out goes out in batches.
    it('sends at most a batch per alarm and comes back soon for the rest', async () => {
        const storage = new MemoryStorage();
        const alerts: { current: AppAlert[] } = { current: [] };
        const { ports, pushed } = world(alerts);
        const devices = DISRUPTION_PUSH.PUSHES_PER_RUN + 5;
        for (let i = 0; i < devices; i++) await subscribe(storage, `d${i}`, [LINE_9]);
        await runAlarm(storage, ports, NOW);

        alerts.current = [incident('new', ['L9'])];
        const at = NOW + POLL_MS;
        await runAlarm(storage, ports, at);
        expect(pushed).toHaveLength(DISRUPTION_PUSH.PUSHES_PER_RUN - 1);
        expect(storage.alarm).toBe(at + DISRUPTION_PUSH.QUEUE_INTERVAL_S * 1000);

        await runAlarm(storage, ports, storage.alarm!);
        expect(pushed).toHaveLength(devices);
        expect(new Set(pushed.map(p => p.device)).size).toBe(devices);
    });

    // A batch costs one write of the fan-out's place, however many pushes it sends.
    it('writes once per batch while fanning out', async () => {
        const storage = new MemoryStorage();
        const alerts: { current: AppAlert[] } = { current: [] };
        const { ports, pushed } = world(alerts);
        const devices = 100;
        for (let i = 0; i < devices; i++) await subscribe(storage, `d${String(i).padStart(3, '0')}`, [LINE_9]);
        await runAlarm(storage, ports, NOW);
        alerts.current = [incident('new', ['L9'])];
        const writes = storage.writes;
        let at = NOW + POLL_MS;
        await runAlarm(storage, ports, at);
        while (storage.data.has('fanout')) {
            at = storage.alarm!;
            await runAlarm(storage, ports, at);
        }
        expect(pushed).toHaveLength(devices);
        const batches = Math.ceil((devices + 1) / DISRUPTION_PUSH.PUSHES_PER_RUN);
        // The seen list, then the fan-out's place after every batch but the last.
        expect(storage.writes - writes).toBe(1 + batches - 1);
        expect(storage.alarm).toBe(at + POLL_MS);
    });

    it('pushes one subscriber at most a few of the incidents that start at once', async () => {
        const storage = new MemoryStorage();
        const alerts: { current: AppAlert[] } = { current: [] };
        const { ports, pushed } = world(alerts);
        await subscribe(storage, 'd1', [LINE_9]);
        await runAlarm(storage, ports, NOW);
        alerts.current = ['a', 'b', 'c', 'd', 'e'].map(guid => incident(guid, ['L9']));
        await runAlarm(storage, ports, NOW + POLL_MS);
        expect(pushed).toHaveLength(DISRUPTION_PUSH.MAX_PUSHES_PER_SUBSCRIBER);
        expect(pushed[0].badge).toBe(5);
    });

    it('skips a queued push whose subscription was removed meanwhile', async () => {
        const storage = new MemoryStorage();
        const alerts: { current: AppAlert[] } = { current: [] };
        const { ports, pushed } = world(alerts);
        for (let i = 0; i < DISRUPTION_PUSH.PUSHES_PER_RUN + 1; i++) await subscribe(storage, `d${String(i).padStart(2, '0')}`, [LINE_9]);
        await runAlarm(storage, ports, NOW);
        alerts.current = [incident('new', ['L9'])];
        await runAlarm(storage, ports, NOW + POLL_MS);
        const waiting = DISRUPTION_PUSH.PUSHES_PER_RUN;
        await handleRequest(storage, { action: 'remove', endpoint: endpoint(`d${waiting}`) }, NOW + POLL_MS);

        await runAlarm(storage, ports, storage.alarm!);
        expect(pushed.map(p => p.device)).not.toContain(`d${waiting}`);
    });
});
