import { describe, expect, it } from 'vitest';
import type { Ride, RideStatus, VehicleDetail } from '@/types';
import { MIN, NOW, stopTime, vehicleDetail } from '@/test/factories';
import { countStopsLeft, deriveRide, exitArrival, followedRideFirst, rideAlertFor } from './status';

// NOW is 14:00 in Prague; the trip runs 13:50–14:30 and the rider gets off at stop 4 (14:20).
const stops = [stopTime(1, '13:50:00'), stopTime(2, '14:00:00'), stopTime(3, '14:10:00'), stopTime(4, '14:20:00'), stopTime(5, '14:30:00')];

const TZ = 'Europe/Prague';

const ride: Ride = { city: 'prague', tripId: 'trip-1', vehicleId: 'veh-trip-1', exitSequence: 4, exitStopName: 'Stop 4', startedAt: NOW - 10 * MIN };

const atStop = (sequence: number | null, overrides: Partial<VehicleDetail> = {}) =>
    vehicleDetail({
        state_position: sequence === null ? 'before_track' : 'on_track',
        last_stop_sequence: sequence,
        delay: 0,
        stop_times: { type: 'FeatureCollection', features: stops },
        ...overrides,
    });

// The ride bar and its alerts are driven entirely by this phase.
describe('deriveRide', () => {
    it.each([
        ['waiting', atStop(null)],
        ['riding', atStop(2)],
        ['next', atStop(3)],
        ['arrived', atStop(4)],
    ] as const)('reports %s from the vehicle\'s last passed stop', (phase, detail) => {
        expect(deriveRide(ride, detail, false, NOW, TZ)?.phase).toBe(phase);
    });

    it('counts the stops left including the exit and reports progress towards it', () => {
        expect(deriveRide(ride, atStop(2), false, NOW, TZ)).toMatchObject({ stopsLeft: 2, progress: 1 / 3 });
    });

    // A timetable-only fallback has no live stop; the ride ends once the last stop is past by the grace period.
    it('ends the ride when the trip is over by the clock', () => {
        const late = deriveRide(ride, atStop(2), false, Date.parse('2026-10-07T12:40:00Z'), TZ);
        expect(late?.phase).toBe('arrived');
    });

    it('shows arrival time and minutes with the live delay', () => {
        expect(deriveRide(ride, atStop(2, { delay: 180 }), false, NOW, TZ)).toMatchObject({ arrivalTime: '14:23', minutesToArrival: 23 });
    });

    // Reopening the app hours after getting off must not greet the rider with "you have arrived".
    it('drops a ride that arrived long ago, but shows a fresh arrival', () => {
        expect(deriveRide(ride, atStop(4), false, Date.parse('2026-10-07T12:21:00Z'), TZ)?.phase).toBe('arrived');
        expect(deriveRide(ride, atStop(4), false, Date.parse('2026-10-07T12:45:00Z'), TZ)).toBeNull();
    });

    it('tells a failed load from a pending one, and drops an expired ride', () => {
        expect(deriveRide(ride, undefined, true, NOW, TZ)?.phase).toBe('unavailable');
        expect(deriveRide(ride, undefined, false, NOW, TZ)?.phase).toBe('loading');
        expect(deriveRide({ ...ride, startedAt: NOW - 5 * 60 * MIN }, atStop(2), false, NOW, TZ)).toBeNull();
    });
});

describe('exitArrival', () => {
    it('prefers the realtime arrival, else adds the trip delay to the timetable', () => {
        const withRealtime = [stopTime(4, '14:20:00', { realtime_arrival_time: '14:26:00' })];

        expect(exitArrival(withRealtime, 4, 60)?.time).toBe('14:26');
        expect(exitArrival(stops, 4, 60)?.time).toBe('14:21');
        expect(exitArrival(stops, 9, 60)).toBeNull();
    });
});

// DÚK rail times stay on the service day (`24:30`), so arrival minutes must wrap to after midnight.
describe('minutes to arrival past midnight', () => {
    it('counts minutes to a 24:30 exit from 00:10, not a day', () => {
        const late = [stopTime(1, '23:50:00'), stopTime(2, '24:00:00'), stopTime(3, '24:30:00')];
        const lateRide: Ride = { ...ride, exitSequence: 3, startedAt: Date.parse('2026-10-08T00:00:00+02:00') };
        const detail = vehicleDetail({ state_position: 'on_track', last_stop_sequence: 1, delay: null, stop_times: { type: 'FeatureCollection', features: late } });

        expect(deriveRide(lateRide, detail, false, Date.parse('2026-10-08T00:10:00+02:00'), TZ)?.minutesToArrival).toBe(20);
    });
});

describe('countStopsLeft', () => {
    it('counts stops after the current one up to and including the exit', () => {
        expect(countStopsLeft(stops, 1, 4)).toBe(3);
        expect(countStopsLeft(stops, 4, 4)).toBe(0);
    });
});

// One notification per stop-before-exit and per arrival; resuming a ride (app reopened) never re-alerts.
describe('rideAlertFor', () => {
    it('alerts on entering the stop before the exit and on arrival', () => {
        expect(rideAlertFor('riding', 'next', new Set())).toBe('next');
        expect(rideAlertFor('next', 'arrived', new Set())).toBe('arrived');
        expect(rideAlertFor('waiting', 'riding', new Set())).toBeNull();
    });

    it('stays quiet on a resumed ride, an unchanged phase or one already alerted', () => {
        expect(rideAlertFor(null, 'next', new Set())).toBeNull();
        expect(rideAlertFor('next', 'next', new Set())).toBeNull();
        expect(rideAlertFor('riding', 'next', new Set(['next']))).toBeNull();
    });
});

describe('followedRideFirst', () => {
    const status = (phase: RideStatus['phase']) => ({ ...deriveRide(ride, atStop(2), false, NOW, TZ)!, phase });

    it('puts the followed ride in front only when it alone is urgent', () => {
        expect(followedRideFirst(status('riding'), status('next'))).toBe(true);
        expect(followedRideFirst(status('arrived'), status('next'))).toBe(false);
        expect(followedRideFirst(null, status('riding'))).toBe(false);
    });
});
