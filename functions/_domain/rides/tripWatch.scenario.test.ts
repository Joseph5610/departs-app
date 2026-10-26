import { describe, expect, it } from 'vitest';
import { observe } from './observation';
import { MIN, NOW, read, scheduledAt, type World } from './testTrip';
import { firstCheckAt, riderStep, type TripAlert, type WatchRider } from './tripWatch';

interface Sent {
    alert: TripAlert;
    /** Minutes from NOW. */
    at: number;
}

/** Runs the rider's alarms as the Durable Object schedules them, from registration until done or `untilMin`. */
const simulate = (rider: WatchRider, world: World, registeredAt = NOW, untilMin = 120): Sent[] => {
    const sent: Sent[] = [];
    let current = rider;
    let at = firstCheckAt(rider, registeredAt);
    for (let i = 0; i < 1000 && at <= NOW + untilMin * MIN; i++) {
        const step = riderStep(current, observe(read(world, at)), at);
        for (const alert of step.send) sent.push({ alert, at: (at - NOW) / MIN });
        if (step.nextAt === null) break;
        current = { ...current, phase: step.phase };
        at = Math.max(step.nextAt, at + 1000);
    }
    return sent;
};

const alertsOf = (sent: Sent[]) => sent.map(s => s.alert);
const sentAt = (sent: Sent[], alert: TripAlert) => sent.find(s => s.alert === alert)?.at ?? null;

// Boards at stop 3 (timetabled at +12 min) with a 5 min alert, gets off at stop 6 (+24 min).
const rider = (extra: Partial<WatchRider> = {}): WatchRider => ({
    exitSequence: 6,
    board: { sequence: 3, scheduledMs: scheduledAt(3), leadMin: 5 },
    phase: 'remind',
    ...extra,
});

describe('trip watch scenarios', () => {
    it('sends each alert once, in order, at the right moments on an on-time trip', () => {
        const sent = simulate(rider(), {});
        expect(alertsOf(sent)).toEqual(['soon', 'next', 'arrived']);
        expect(sentAt(sent, 'soon')).toBeGreaterThanOrEqual(12 - 5 - 0.5);
        expect(sentAt(sent, 'soon')).toBeLessThan(12);
        expect(sentAt(sent, 'next')).toBeGreaterThanOrEqual(20);
        expect(sentAt(sent, 'arrived')).toBeGreaterThanOrEqual(24);
    });

    it('follows a late trip: the boarding alert waits for the delay', () => {
        const sent = simulate(rider(), { delayMin: 6 });
        expect(alertsOf(sent)).toEqual(['soon', 'next', 'arrived']);
        expect(sentAt(sent, 'soon')).toBeGreaterThanOrEqual(18 - 5 - 0.5);
        expect(sentAt(sent, 'soon')).toBeLessThan(18);
        expect(sentAt(sent, 'arrived')).toBeGreaterThanOrEqual(30);
    });

    // One failed read must never lose an alert, wherever it falls.
    it('sends the same alerts whatever single read fails', () => {
        for (let minute = 0; minute < 40; minute += 0.5) {
            const sent = simulate(rider(), { delayMin: 6, failing: [[minute * MIN, minute * MIN + 20_000]] });
            expect(alertsOf(sent), `failing at +${minute} min`).toEqual(['soon', 'next', 'arrived']);
        }
    });

    it('never sends the boarding alert after the vehicle has left the stop', () => {
        for (const delayMin of [0, 3, 6, 15]) {
            const sent = simulate(rider(), { delayMin });
            expect(sentAt(sent, 'soon'), `delay ${delayMin}`).toBeLessThan(12 + delayMin);
        }
        // Registered once the vehicle already left the boarding stop: no late boarding alert.
        expect(alertsOf(simulate(rider(), {}, NOW + 13 * MIN))).toEqual(['next', 'arrived']);
    });

    it('ends boarding on the clock when the position stalls before the stop, inventing no exit alerts', () => {
        const sent = simulate(rider(), { stallAt: 9 * MIN });
        expect(alertsOf(sent)).toEqual(['soon']);
    });

    it('sends the boarding alert on the timetable when the feed has no live position', () => {
        const sent = simulate(rider({ exitSequence: null }), { timetableOnly: true });
        expect(alertsOf(sent)).toEqual(['soon']);
        expect(sentAt(sent, 'soon')).toBeLessThan(12);
    });

    it('reports a cancellation once, and nothing after it', () => {
        expect(alertsOf(simulate(rider(), { cancelAt: 2 * MIN }))).toEqual(['cancelled']);
    });

    // An edit replaces the registration: a boarding alert still due goes again with the time left, never after the vehicle left.
    it('starts a re-save afresh', () => {
        expect(alertsOf(simulate(rider({ exitSequence: null }), {}, NOW, 9))).toEqual(['soon']);
        expect(alertsOf(simulate(rider(), {}, NOW + 9 * MIN))).toEqual(['soon', 'next', 'arrived']);
        expect(alertsOf(simulate(rider(), {}, NOW + 12.6 * MIN))).toEqual(['next', 'arrived']);
    });
});
