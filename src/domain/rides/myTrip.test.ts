import { describe, expect, it } from 'vitest';
import type { MyTrip, VehicleDetail } from '@/types';
import { boardingsBefore, byUrgency, deriveMyTrip, exitsAfter, followedUrgency, isTripExpired, isTripUnderway, tripPushKey, tripStartOf, tripUrgency, watchFrom, withRegistration } from './myTrip';

const TZ = 'Europe/Prague';
// 2026-10-20 12:00:00 in Prague.
const NOW = Date.UTC(2026, 9, 20, 10, 0, 0);
const MIN = 60_000;

const stop = (stop_sequence: number, time: string) => ({
    type: 'Feature' as const,
    properties: { stop_id: `s${stop_sequence}`, stop_name: `Stop ${stop_sequence}`, stop_sequence, arrival_time: time, departure_time: time },
});

const detail = (last_stop_sequence: number | null, extra: Partial<VehicleDetail> = {}) => ({
    gtfs_trip_id: 't1',
    state_position: last_stop_sequence === null ? 'before_track' : 'on_track',
    last_stop_sequence,
    delay: 0,
    route_short_name: '22',
    route_color: '#7A0603',
    stop_times: { features: [stop(1, '12:00:00'), stop(2, '12:05:00'), stop(3, '12:10:00'), stop(4, '12:20:00'), stop(5, '12:30:00')] },
    ...extra,
}) as unknown as VehicleDetail;

const trip = (extra: Partial<MyTrip> = {}): MyTrip => ({
    city: 'prague', tripId: 't1', vehicleId: null, exitSequence: 5, startedAt: NOW,
    board: { sequence: 3, stopId: 's3', stopName: 'Stop 3', scheduledMs: NOW + 10 * MIN, leadMin: 5 },
    toEnd: false,
    ...extra,
});

describe('deriveMyTrip', () => {
    it('counts down to boarding until the vehicle reaches the stop', () => {
        const status = deriveMyTrip(trip(), detail(1), false, NOW, TZ);
        expect(status).toMatchObject({ phase: 'boarding', stopName: 'Stop 3', departureTime: '12:10', minutes: 10, isSoon: false });
        expect(deriveMyTrip(trip(), detail(2), false, NOW + 6 * MIN, TZ)).toMatchObject({ phase: 'boarding', isSoon: true });
    });

    it('becomes the ride once the vehicle left the boarding stop', () => {
        expect(deriveMyTrip(trip(), detail(3), false, NOW + 10 * MIN, TZ)).toMatchObject({ phase: 'riding', ride: { phase: 'riding' } });
    });

    // A vehicle standing at the user's stop hasn't left it: boarding (and its alert) isn't over yet.
    it('keeps boarding while the vehicle stands at the boarding stop', () => {
        expect(deriveMyTrip(trip(), detail(3, { state_position: 'at_stop' }), false, NOW + 8 * MIN, TZ)?.phase).toBe('boarding');
    });

    // Without a live position the clock decides, a little after the expected departure.
    it('takes a trip without a position as boarded shortly after its departure', () => {
        expect(deriveMyTrip(trip(), detail(null), false, NOW + 11 * MIN, TZ)?.phase).toBe('boarding');
        expect(deriveMyTrip(trip(), detail(null), false, NOW + 13 * MIN, TZ)?.phase).toBe('riding');
    });

    // The stop's own realtime time wins over the trip's delay, as on the server.
    it('counts down to the boarding stop own realtime departure', () => {
        const late = detail(1, { delay: 60, stop_times: { features: [stop(1, '12:00:00'), { ...stop(3, '12:10:00'), properties: { ...stop(3, '12:10:00').properties, realtime_departure_time: '12:14:00' } }] } } as Partial<VehicleDetail>);
        expect(deriveMyTrip(trip(), late, false, NOW, TZ)).toMatchObject({ phase: 'boarding', minutes: 14, departureTime: '12:14' });
    });

    // A stalled live position (it still says before the stop) must not keep the bar on "boarding" forever.
    it('ends boarding by the clock even when the live position never moves past the stop', () => {
        expect(deriveMyTrip(trip(), detail(2), false, NOW + 13 * MIN, TZ)?.phase).toBe('riding');
        expect(deriveMyTrip(trip(), detail(2, { delay: 300 }), false, NOW + 13 * MIN, TZ)?.phase).toBe('boarding');
    });

    it('is a ride straight away without a boarding stop, and waits while loading', () => {
        expect(deriveMyTrip(trip({ board: null }), detail(2), false, NOW, TZ)?.phase).toBe('riding');
        expect(deriveMyTrip(trip(), undefined, false, NOW, TZ)).toMatchObject({ phase: 'riding', ride: { phase: 'loading' } });
    });

    // A failed detail must not hide the countdown (and its in-app alert): the timetable still tells.
    it('counts down on the timetable when the detail fails', () => {
        expect(deriveMyTrip(trip(), undefined, true, NOW + 6 * MIN, TZ)).toMatchObject({ phase: 'boarding', minutes: 4, isSoon: true, routeName: '' });
    });

    // Saved in the morning for a trip ending after midnight: the ride's 12 h timetable clock must not end it.
    it('keeps a trip boarding more than 12 h ahead', () => {
        const night = detail(null, { stop_times: { features: [stop(1, '23:30:00'), stop(2, '00:15:00')] } } as Partial<VehicleDetail>);
        const later = trip({ exitSequence: 2, board: { sequence: 1, stopId: 's1', stopName: 'Stop 1', scheduledMs: NOW + 690 * MIN, leadMin: 5 } });
        expect(deriveMyTrip(later, night, false, NOW, TZ)).toMatchObject({ phase: 'boarding', minutes: 690, arrivalTime: '00:15' });
    });
});

describe('isTripExpired', () => {
    // A trip saved hours ahead must not expire before it even leaves.
    it('ages from the departure, not from when it was saved', () => {
        const ahead = trip({ startedAt: NOW, board: { ...trip().board!, scheduledMs: NOW + 5 * 60 * MIN } });
        expect(isTripExpired(ahead, NOW + 6 * 60 * MIN)).toBe(false);
        expect(isTripExpired(trip({ board: null }), NOW + 5 * 60 * MIN)).toBe(true);
    });

    // Without a boarding stop, a trip saved before it runs ages (and is watched) from its first departure.
    it('ages a trip without a boarding stop from its first departure', () => {
        const later = trip({ board: null, start: { sequence: 1, scheduledMs: NOW + 5 * 60 * MIN } });
        expect(isTripExpired(later, NOW + 6 * 60 * MIN)).toBe(false);
        expect(isTripUnderway(later, NOW)).toBe(false);
        expect(watchFrom(later)).toEqual({ sequence: 1, scheduledMs: NOW + 5 * 60 * MIN, leadMin: null });
    });
});

describe('tripStartOf', () => {
    it('is the first call only while the trip has not run', () => {
        const calls = [{ sequence: 1, scheduledMs: NOW + 30 * MIN }, { sequence: 2, scheduledMs: NOW + 35 * MIN }];
        expect(tripStartOf(calls, null, NOW)).toEqual({ sequence: 1, scheduledMs: NOW + 30 * MIN });
        expect(tripStartOf(calls, 0, NOW)).toBeNull();
        expect(tripStartOf(calls, null, NOW + 31 * MIN)).toBeNull();
    });
});

describe('withRegistration', () => {
    // An unchanged trip keeps its server registration; a changed one gets a new one, not pushed until the server confirms.
    it('keeps the revision and pushed mark only while the pushed alerts are unchanged', () => {
        const saved = trip({ revision: 1, pushed: true });
        expect(withRegistration(trip(), saved, 2)).toMatchObject({ revision: 1, pushed: true });
        // A ride from before revisions keeps having none, so its removal still names the registration the server has.
        expect(withRegistration(trip(), trip({ pushed: true }), 2)).toMatchObject({ revision: undefined, pushed: true });
        const moved = withRegistration(trip({ exitSequence: 4 }), saved, 2);
        expect(moved).toMatchObject({ revision: 2 });
        expect(moved.pushed).toBeUndefined();
    });
});

describe('withRegistration boarding alert mark', () => {
    // The server carries a sent boarding alert across a re-save at the same stop; the app must not alert it again either.
    it('keeps the alerted mark at the same stop with another lead, and drops it at another stop', () => {
        const alerted = trip({ board: { ...trip().board!, alerted: true } });
        expect(withRegistration(trip({ board: { ...trip().board!, leadMin: 10 } }), alerted, 2).board?.alerted).toBe(true);
        expect(withRegistration(trip({ board: { ...trip().board!, sequence: 2 } }), alerted, 2).board?.alerted).toBeUndefined();
    });
});

describe('boardingsBefore and exitsAfter', () => {
    it('keep boarding before the exit and the exit after boarding', () => {
        const stops = [{ sequence: 2 }, { sequence: 3 }, { sequence: 4 }];
        expect(boardingsBefore(stops, 4)).toEqual([{ sequence: 2 }, { sequence: 3 }]);
        expect(exitsAfter(stops, 2)).toEqual([{ sequence: 3 }, { sequence: 4 }]);
        expect(exitsAfter(stops, null)).toEqual(stops);
    });
});

describe('byUrgency', () => {
    it('orders front to back, ties in place', () => {
        expect(byUrgency([{ urgency: 2, id: 'a' }, { urgency: 0, id: 'b' }, { urgency: 2, id: 'c' }]).map(x => x.id)).toEqual(['b', 'a', 'c']);
    });
});

describe('tripPushKey', () => {
    it('names the alerts the trip asks for, and none for a trip with nothing to push', () => {
        expect(tripPushKey(trip())).toBe('t1|5|3:5');
        expect(tripPushKey(trip({ toEnd: true }))).toBe('t1|-|3:5');
        expect(tripPushKey(trip({ toEnd: true, board: { ...trip().board!, leadMin: null } }))).toBeNull();
    });
});

describe('tripUrgency', () => {
    // The stop before the exit beats a boarding still minutes away, which beats a trip simply under way.
    it('puts the exit first, then boarding soon, then boarding, then riding', () => {
        const boarding = deriveMyTrip(trip(), detail(1), false, NOW, TZ)!;
        const soon = deriveMyTrip(trip(), detail(2), false, NOW + 6 * MIN, TZ)!;
        const riding = deriveMyTrip(trip({ board: null }), detail(2), false, NOW, TZ)!;
        const next = deriveMyTrip(trip({ board: null }), detail(4), false, NOW, TZ)!;
        expect([riding, boarding, next, soon].sort((a, b) => tripUrgency(a) - tripUrgency(b))).toEqual([next, soon, boarding, riding]);
    });
});

// The trip under way and arriving sooner beats a boarding that's further off.
it('puts a ride arriving sooner before a later boarding', () => {
    const laterBoarding = deriveMyTrip(trip({ board: { ...trip().board!, scheduledMs: NOW + 63 * MIN, sequence: 5 } }), detail(1, { stop_times: { features: [stop(1, '12:00:00'), stop(5, '13:03:00')] } } as Partial<VehicleDetail>), false, NOW, TZ)!;
    const riding = deriveMyTrip(trip({ board: null }), detail(2), false, NOW, TZ)!;
    expect(laterBoarding.phase).toBe('boarding');
    expect([laterBoarding, riding].sort((a, b) => tripUrgency(a) - tripUrgency(b))).toEqual([riding, laterBoarding]);
});

// Someone else's trip yields to the user's own at the same moment, but not to a later one.
it('puts a followed trip behind the user own at the same moment only', () => {
    const own = deriveMyTrip(trip({ board: null }), detail(2), false, NOW, TZ)!;
    const followed = deriveMyTrip(trip({ board: null }), detail(4), false, NOW, TZ)!;
    expect(followedUrgency(own)).toBeGreaterThan(tripUrgency(own));
    expect(followedUrgency(followed)).toBeLessThan(tripUrgency(own));
});

// A trip saved for this evening must not make the map act as if the user were riding now.
it('counts a trip as under way only aboard or close to its departure', () => {
    expect(isTripUnderway(trip({ board: null }), NOW)).toBe(true);
    expect(isTripUnderway(trip(), NOW)).toBe(true);
    expect(isTripUnderway(trip({ board: { ...trip().board!, scheduledMs: NOW + 3 * 60 * MIN } }), NOW)).toBe(false);
});
