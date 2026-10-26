import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RIDE_PUSH } from '../../_core/config';
import { MIN, NOW, read, scheduledAt, type World } from './testTrip';
import type { WatchBoard } from './tripWatch';
import { handleRequest, runAlarm, type Rider, type WatchPorts, type WatchStorage } from './watchRun';

/** A Durable Object's storage in memory; values are copied in and out, as the real one serializes them. */
class MemoryStorage implements WatchStorage {
    data = new Map<string, unknown>();
    alarm: number | null = null;
    async get<T>(key: string) { return structuredClone(this.data.get(key)) as T | undefined; }
    async put<T>(key: string, value: T) { this.data.set(key, structuredClone(value)); }
    async delete(key: string) { return this.data.delete(key); }
    async list<T>({ prefix }: { prefix: string }) {
        return new Map([...this.data].filter(([key]) => key.startsWith(prefix)).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, structuredClone(value) as T]));
    }
    async deleteAll() { this.data.clear(); this.alarm = null; }
    async getAlarm() { return this.alarm; }
    async setAlarm(at: number) { this.alarm = at; }
}

interface Pushed {
    device: string;
    title: string;
    body: string;
    /** Minutes from NOW. */
    at: number;
    status: number;
}

const endpoint = (device: string) => `https://fcm.googleapis.com/fcm/send/${device}`;
const deviceOf = (url: string) => url.slice(url.lastIndexOf('/') + 1);

// Boards at stop 3 (timetabled at +12 min) with a 5 min alert, gets off at stop 6 (+24 min).
const BOARD: WatchBoard = { sequence: 3, scheduledMs: scheduledAt(3), leadMin: 5 };
const TEXTS = Object.fromEntries((['soon', 'cancelled', 'next', 'arrived'] as const).map(alert => [alert, { title: alert, body: `{min} min` }]));

const add = (storage: WatchStorage, device: string, at: number, rider: { board?: WatchBoard | null; exitSequence?: number | null } = {}) =>
    handleRequest(storage, {
        action: 'add',
        trip: { city: 'prague', tripId: 'trip-1' },
        rider: {
            subscription: { endpoint: endpoint(device), keys: { p256dh: 'p', auth: 'a' } },
            exitSequence: rider.exitSequence === undefined ? 6 : rider.exitSequence,
            board: rider.board === undefined ? BOARD : rider.board,
            texts: TEXTS,
            navigate: 'https://departs.app/prague/trip/trip-1',
        },
    }, at);

/** Fires the watch's alarms in time order, as the runtime does, until none is left or `untilMin` passes. */
const run = async (storage: MemoryStorage, world: World, { untilMin = 300, status = () => 201, onPush }: {
    untilMin?: number;
    /** The push service's answer to each push. */
    status?: (pushed: Omit<Pushed, 'status'>) => number;
    onPush?: (at: number) => Promise<void>;
} = {}) => {
    const pushed: Pushed[] = [];
    const reads: number[] = [];
    while (storage.alarm !== null && storage.alarm <= NOW + untilMin * MIN) {
        const now = storage.alarm;
        storage.alarm = null;
        const ports: WatchPorts = {
            readDetail: async () => { reads.push(now); return read(world, now); },
            push: async (subscription, payload) => {
                const { title, body } = (JSON.parse(payload) as { notification: { title: string; body: string } }).notification;
                const sent = { device: deviceOf(subscription.endpoint), title, body, at: (now - NOW) / MIN };
                const answer = status(sent);
                pushed.push({ ...sent, status: answer });
                await onPush?.(now);
                return answer;
            },
        };
        await runAlarm(storage, ports, now);
    }
    return { pushed, reads, delivered: pushed.filter(p => p.status >= 200 && p.status < 300) };
};

const titles = (pushed: Pushed[], device = 'a') => pushed.filter(p => p.device === device).map(p => p.title);

describe('trip watch alarms', () => {
    let storage: MemoryStorage;
    beforeEach(() => {
        storage = new MemoryStorage();
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    it('pushes the boarding alert, next and arrived once each, then forgets the trip', async () => {
        await add(storage, 'a', NOW);
        const { delivered } = await run(storage, {});
        expect(titles(delivered)).toEqual(['soon', 'next', 'arrived']);
        expect(delivered[0].body).toMatch(/^[56] min$/);
        expect(storage.data.size).toBe(0);
        expect(storage.alarm).toBeNull();
    });

    it('gives each rider on the trip their own alerts', async () => {
        await add(storage, 'a', NOW);
        await add(storage, 'b', NOW, { board: { ...BOARD, leadMin: 2 }, exitSequence: null });
        const { delivered } = await run(storage, {});
        expect(titles(delivered, 'a')).toEqual(['soon', 'next', 'arrived']);
        expect(titles(delivered, 'b')).toEqual(['soon']);
        expect(delivered.find(p => p.device === 'b')!.at).toBeGreaterThan(delivered.find(p => p.device === 'a')!.at);
    });

    // I4: a subscription the push service says is gone gets nothing more, and doesn't stop the others.
    it.each([404, 410])('drops a rider whose subscription is gone (%i)', async gone => {
        await add(storage, 'a', NOW);
        await add(storage, 'b', NOW);
        const { pushed } = await run(storage, {}, { status: p => (p.device === 'a' ? gone : 201) });
        expect(titles(pushed, 'a')).toEqual(['soon']);
        expect(titles(pushed, 'b')).toEqual(['soon', 'next', 'arrived']);
    });

    // I3: a push the service didn't take is sent again, and the rider doesn't move past it meanwhile.
    it.each([429, 503, 0])('retries a push the service didn\'t take (%i) until it does', async refused => {
        await add(storage, 'a', NOW);
        let refusals = 2;
        const { pushed, delivered } = await run(storage, {}, { status: p => (p.title === 'soon' && refusals-- > 0 ? refused : 201) });
        expect(titles(pushed)).toEqual(['soon', 'soon', 'soon', 'next', 'arrived']);
        expect(titles(delivered)).toEqual(['soon', 'next', 'arrived']);
        expect(pushed[1].at - pushed[0].at).toBeCloseTo(RIDE_PUSH.RETRY_INTERVAL_S / 60);
    });

    // I8: a trip id that was never found costs two reads.
    it('gives up a trip whose detail never answered after two failed reads', async () => {
        await add(storage, 'a', NOW);
        const { pushed, reads } = await run(storage, { failing: [[-MIN, 300 * MIN]] });
        expect(pushed).toEqual([]);
        expect(reads).toHaveLength(RIDE_PUSH.MAX_FAILURES_UNSEEN);
        expect(storage.data.size).toBe(0);
    });

    // I8: a trip that answered once and then keeps failing backs off, and is given up within about an hour.
    it('backs off failed reads up to the limit and then gives the trip up', async () => {
        await add(storage, 'a', NOW + 13 * MIN, { board: null });
        const { reads } = await run(storage, { failing: [[14 * MIN, 300 * MIN]] });
        const failed = reads.filter(at => at >= NOW + 14 * MIN);
        const gaps = failed.slice(1).map((at, i) => (at - failed[i]) / 1000);
        expect(failed).toHaveLength(RIDE_PUSH.MAX_FAILURES);
        expect(gaps).toEqual([...gaps].sort((a, b) => a - b));
        expect(Math.max(...gaps)).toBe(RIDE_PUSH.MAX_RETRY_INTERVAL_S);
        expect((failed.at(-1)! - NOW) / MIN).toBeLessThan(14 + 90);
        expect(storage.data.size).toBe(0);
    });

    // I3: failed reads around the boarding alert must not push it past the departure.
    it('still sends a boarding alert on time while reads fail', async () => {
        await add(storage, 'a', NOW);
        const { delivered } = await run(storage, { failing: [[3 * MIN, 11 * MIN]] }, { untilMin: 11 });
        expect(titles(delivered)).toEqual(['soon']);
        expect(delivered[0].at).toBeLessThanOrEqual(12 - BOARD.leadMin! + RIDE_PUSH.MIN_CHECK_INTERVAL_MS / MIN);
    });

    // The alarm's outcome for the old registration must not overwrite the new one: the new one still gets its own alert.
    it('keeps a registration that replaced the rider while the alarm ran', async () => {
        await add(storage, 'a', NOW);
        let replaced = false;
        const { delivered } = await run(storage, {}, {
            untilMin: 11,
            onPush: async at => {
                if (replaced) return;
                replaced = true;
                await add(storage, 'a', at + 1, { board: { ...BOARD, leadMin: 2 } });
            },
        });
        expect(titles(delivered)).toEqual(['soon', 'soon']);
        expect(delivered[1].at).toBeGreaterThanOrEqual(12 - 2 - 0.5);
        expect(await storage.get<Rider>(`rider:${endpoint('a')}`)).toMatchObject({ phase: 'board', board: { leadMin: 2 } });
    });

    // A vehicle that left the feed while reads still answer ends the exit watch; it doesn't wait out the failure limit.
    it('ends the exit watch once a live vehicle has vanished from the feed', async () => {
        await add(storage, 'a', NOW + 13 * MIN, { board: null });
        const { reads } = await run(storage, { vanishAt: 15 * MIN });
        expect((reads.at(-1)! - NOW) / MIN).toBeLessThan(15 + RIDE_PUSH.LOST_MS / MIN + 2);
        expect(storage.data.size).toBe(0);
    });

    it('reports a cancelled trip once and forgets the rider', async () => {
        await add(storage, 'a', NOW);
        const { delivered } = await run(storage, { cancelAt: 2 * MIN });
        expect(titles(delivered)).toEqual(['cancelled']);
        expect(storage.data.size).toBe(0);
    });

    // I5: a rider is kept until well after the departure, then dropped even when the trip never reports arriving.
    it('drops a rider when it expires', async () => {
        await add(storage, 'a', NOW + 13 * MIN, { board: null });
        await run(storage, { stallAt: 15 * MIN }, { untilMin: 300 });
        expect(storage.data.size).toBe(0);
    });

    it('turns away riders past the limit, but not a device re-registering', async () => {
        for (let i = 0; i < RIDE_PUSH.MAX_RIDERS; i++) await add(storage, `d${i}`, NOW);
        expect(await add(storage, 'extra', NOW)).toBe(429);
        expect(await add(storage, 'd0', NOW)).toBe(204);
    });

    // A rider stored before 0.88 has no phase: it is aboard, with `next` already sent or not.
    it('carries on a rider registered before 0.88', async () => {
        await storage.put('trip', { city: 'prague', tripId: 'trip-1' });
        await storage.put(`rider:${endpoint('a')}`, {
            subscription: { endpoint: endpoint('a'), keys: { p256dh: 'p', auth: 'a' } }, exitSequence: 6, texts: TEXTS,
            navigate: '', revision: null, alerted: ['next'], expiresAt: NOW + 240 * MIN,
        });
        storage.alarm = NOW + 21 * MIN;
        const { delivered } = await run(storage, {});
        expect(titles(delivered)).toEqual(['arrived']);
    });

    it('forgets the trip once its last rider is removed', async () => {
        await add(storage, 'a', NOW);
        await handleRequest(storage, { action: 'remove', endpoint: endpoint('a') }, NOW);
        const { pushed } = await run(storage, {});
        expect(pushed).toEqual([]);
        expect(storage.data.size).toBe(0);
    });

    it('reads the trip at most once per near interval however often riders are added', async () => {
        await add(storage, 'a', NOW, { board: null });
        await run(storage, {}, { untilMin: 0 });
        await add(storage, 'b', NOW + 1000, { board: null });
        expect(storage.alarm).toBe(NOW + RIDE_PUSH.NEAR_INTERVAL_S * 1000);
    });
});
