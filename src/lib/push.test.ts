import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MyTrip } from '@/types';
import { backgroundEndpoint, startDisruptionPush, startTripPush, stopDisruptionPush, stopTripPush } from './push';

const NOW = Date.UTC(2026, 9, 20, 10, 0, 0);

const trip = (tripId: string): MyTrip => ({
    city: 'prague', tripId, vehicleId: null, exitSequence: 5, startedAt: NOW, toEnd: false,
    board: { sequence: 3, stopId: 's3', stopName: 'Stop 3', scheduledMs: NOW + 600_000, leadMin: 5 },
});

/** The browser's push subscription, granted only when the test says the user answered the permission prompt. */
const fakePushManager = () => {
    let subscription: { endpoint: string; toJSON: () => object } | null = null;
    let answer = () => {};
    const answered = new Promise<void>(resolve => { answer = resolve; });
    return {
        answer,
        manager: {
            getSubscription: async () => subscription,
            subscribe: async () => {
                await answered;
                subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/device', toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/device' }) };
                return subscription;
            },
        },
    };
};

/** Requests to `/ride` as the server receives them, in order: action and trip. */
let sent: string[];
let refuse: (action: string) => boolean;

beforeEach(() => {
    sent = [];
    refuse = () => false;
    vi.stubGlobal('PushManager', {});
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as { action: string; tripId: string };
        sent.push(`${body.action} ${body.tripId}`);
        return refuse(body.action) ? new Response('{"error":"no"}', { status: 500 }) : new Response('{"ok":true}', { status: 200 });
    }));
});

afterEach(() => {
    vi.unstubAllGlobals();
});

const usePushManager = (manager: ReturnType<typeof fakePushManager>['manager']) =>
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration: async () => ({ pushManager: manager }) } });

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

describe('trip push requests', () => {
    // I4: ending a trip while its save waits on the permission prompt must still reach the server after the save.
    it('sends an end tapped during the permission prompt after the save', async () => {
        const { manager, answer } = fakePushManager();
        usePushManager(manager);
        const saving = startTripPush(trip('t1'), {}, '/prague/trip/t1');
        const ending = stopTripPush(trip('t1'));
        await settle();
        expect(sent).toEqual([]);
        answer();
        await Promise.all([saving, ending]);
        expect(sent).toEqual(['add t1', 'remove t1']);
    });

    it('still sends the end when the save before it failed', async () => {
        const { manager, answer } = fakePushManager();
        usePushManager(manager);
        answer();
        refuse = action => action === 'add';
        const result = await startTripPush(trip('t1'), {}, '/prague/trip/t1');
        await stopTripPush(trip('t1'));
        expect(result.ok).toBe(false);
        expect(sent).toEqual(['add t1', 'remove t1']);
    });

    // I4: a removal that didn't reach the server must be known, so it can be sent again.
    it('reports whether the server took a removal', async () => {
        const { manager, answer } = fakePushManager();
        usePushManager(manager);
        answer();
        await startTripPush(trip('t1'), {}, '/prague/trip/t1');
        refuse = action => action === 'remove';
        expect(await stopTripPush(trip('t1'))).toBe(false);
        refuse = () => false;
        expect(await stopTripPush(trip('t1'))).toBe(true);
    });

    it("doesn't hold one trip's requests behind another's", async () => {
        const { manager, answer } = fakePushManager();
        usePushManager(manager);
        void startTripPush(trip('t1'), {}, '/prague/trip/t1');
        await settle();
        answer();
        await startTripPush(trip('t2'), {}, '/prague/trip/t2');
        await stopTripPush(trip('t2'));
        expect(sent.filter(request => request.endsWith('t2'))).toEqual(['add t2', 'remove t2']);
    });
});

describe('disruption push requests', () => {
    // Switching off and straight back on must leave the server subscribed: the add may not overtake the removal.
    it('sends an add asked during a removal after it', async () => {
        const { manager, answer } = fakePushManager();
        answer();
        usePushManager(manager);
        await manager.subscribe();
        let release = () => {};
        const held = new Promise<void>(resolve => { release = resolve; });
        vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
            const { action } = JSON.parse(String(init.body)) as { action: string };
            sent.push(action);
            if (action === 'remove') await held;
            return new Response('{"ok":true}', { status: 200 });
        }));

        const removing = stopDisruptionPush('prague');
        const adding = startDisruptionPush('prague', [{ name: '9', keys: ['L9'] }], 'Disruption · {lines}', '/prague', false);
        await settle();
        expect(sent).toEqual(['remove']);
        release();
        expect(await removing).toBe(true);
        expect(await adding).toEqual({ ok: true });
        expect(sent).toEqual(['remove', 'add']);
    });

    // A full trip's 429 is not this quota: only the disruption path turns it into `tooMany`.
    it('reports the server refusing a network past its daily quota', async () => {
        const { manager, answer } = fakePushManager();
        answer();
        usePushManager(manager);
        await manager.subscribe();
        vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":true,"message":"Too many subscriptions."}', { status: 429 })));
        expect(await startDisruptionPush('prague', [{ name: '9', keys: ['L9'] }], 'x', '/prague', false)).toEqual({ ok: false, reason: 'tooMany' });
    });
});

describe('a trip push the server refuses', () => {
    it('keeps the server\'s own words for the toast', async () => {
        const { manager, answer } = fakePushManager();
        answer();
        usePushManager(manager);
        vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":true,"message":"Too many riders on this trip."}', { status: 429 })));
        const result = await startTripPush(trip('t1'), {}, '/prague/trip/t1');
        expect(result).toMatchObject({ ok: false, reason: expect.stringContaining('Too many riders') });
    });
});

describe('backgroundEndpoint', () => {
    const noSubscription = (subscribe: () => Promise<{ endpoint: string }>) => vi.stubGlobal('navigator', {
        serviceWorker: { getRegistration: async () => ({ pushManager: { getSubscription: async () => null, subscribe } }) },
    });

    it('renews a subscription the browser dropped while permission stands', async () => {
        noSubscription(async () => ({ endpoint: 'https://push/new' }));
        vi.stubGlobal('Notification', { permission: 'granted' });
        expect(await backgroundEndpoint()).toEqual({ endpoint: 'https://push/new', lost: false });
    });

    it('reports notifications lost once permission is gone', async () => {
        noSubscription(async () => ({ endpoint: 'never' }));
        vi.stubGlobal('Notification', { permission: 'denied' });
        expect(await backgroundEndpoint()).toEqual({ endpoint: null, lost: true });
    });

    // Without a service worker (a dev server, a first load) nothing is known, so the switch must stay as it is.
    it('reports nothing lost without a service worker', async () => {
        vi.stubGlobal('navigator', { serviceWorker: { getRegistration: async () => undefined } });
        expect(await backgroundEndpoint()).toEqual({ endpoint: null, lost: false });
    });

    it('keeps the switch through a passing failure to renew', async () => {
        noSubscription(async () => { throw new Error('offline'); });
        vi.stubGlobal('Notification', { permission: 'granted' });
        expect(await backgroundEndpoint()).toEqual({ endpoint: null, lost: false });
    });
});
