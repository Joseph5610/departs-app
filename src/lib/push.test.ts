import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MyTrip } from '@/types';
import { startTripPush, stopTripPush } from './push';

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
