import { describe, expect, it } from 'vitest';
import type { StopTimeSlice, VehicleCollection } from '@/types';
import { MIN, NOW, at, patch, vehicle } from '@/test/factories';
import { estimateDelay, estimateFleetDelays, indexStopTimeSlice, withEstimatedPatches, type StopTimeIndex } from './delayEstimate';
import { delaySourceOf } from './status';

const TZ = 'Europe/Prague';
const A: [number, number] = [16.60, 49.20];
const B: [number, number] = [16.62, 49.20];
const HALFWAY_AB: [number, number] = [16.61, 49.20];

// NOW is 14:00 in Prague. trip-1: A 13:50, B 13:54–13:55, C 14:00 (end).
const slice: StopTimeSlice = {
    stops: ['A', 'B', 'C'],
    coords: [A, B, [16.64, 49.20]],
    trips: { 'trip-1': [0, 830, 0, 1, 4, 1, 2, 5, 0] },
};
const index = indexStopTimeSlice(slice) as StopTimeIndex;

const onTrip = (offsetMs: number, lastStop: string, state: 'on_track' | 'at_stop', position: [number, number] = HALFWAY_AB) =>
    vehicle('trip-1', { delay: null, last_stop_id: lastStop, state_position: state, origin_timestamp: at(offsetMs) }, position);

describe('estimateDelay', () => {
    // Halfway from A (13:50) to B (13:54) is due at 13:52.
    it('interpolates the schedule between stops by straight-line progress', () => {
        expect(estimateDelay(onTrip(-7 * MIN, 'B', 'on_track'), index, TZ)).toBe(60);
    });

    it('never reports a vehicle as early', () => {
        expect(estimateDelay(onTrip(-9 * MIN, 'B', 'on_track'), index, TZ)).toBe(0);
    });

    it('is on time while a vehicle waits at a stop between its arrival and departure', () => {
        expect(estimateDelay(onTrip(-5.5 * MIN, 'B', 'at_stop', B), index, TZ)).toBe(0);
    });

    it('counts from the scheduled departure for a vehicle still at a stop after it', () => {
        expect(estimateDelay(onTrip(-3 * MIN, 'B', 'at_stop', B), index, TZ)).toBe(120);
    });

    it('has no delay once the trip has finished at its last stop', () => {
        expect(estimateDelay(onTrip(10 * MIN, 'C', 'at_stop'), index, TZ)).toBeNull();
    });

    it('is on time while waiting at the terminus before departure, and late once past it', () => {
        const waiting = (offsetMs: number) => vehicle('trip-1', { last_stop_id: 'A', state_position: 'before_track', origin_timestamp: at(offsetMs) }, A);
        expect(estimateDelay(waiting(-12 * MIN), index, TZ)).toBe(0);
        expect(estimateDelay(waiting(-7 * MIN), index, TZ)).toBe(180);
    });

    it('reports the delay in seconds', () => {
        expect(estimateDelay(onTrip(-7 * MIN + 50_000, 'B', 'on_track'), index, TZ)).toBe(110);
    });

    // An express reports the stops it runs through; its timetable lists only those it calls at.
    it('places a vehicle reporting a stop its trip does not call at by its position', () => {
        expect(estimateDelay(onTrip(-7 * MIN, 'X', 'on_track'), index, TZ)).toBe(60);
    });

    it('ignores a reported stop off the trip when the vehicle is far from every leg', () => {
        expect(estimateDelay(onTrip(-7 * MIN, 'X', 'on_track', [16.61, 49.25]), index, TZ)).toBeNull();
    });

    // The feed often keeps a parked vehicle "in transit" to the last stop it already reached.
    it('has no delay for a vehicle sitting at its last stop after the trip ended, whatever its state', () => {
        expect(estimateDelay(onTrip(10 * MIN, 'C', 'on_track', [16.64, 49.20]), index, TZ)).toBeNull();
    });

    it('has no delay for a vehicle without a position fix', () => {
        expect(estimateDelay(onTrip(-7 * MIN, 'B', 'on_track', [0, 0]), index, TZ)).toBeNull();
    });

    // GTFS writes a trip running past midnight as 24:02; the vehicle's clock already reads 00:03.
    it('compares across midnight', () => {
        const night = indexStopTimeSlice({ ...slice, trips: { 'trip-1': [0, 1438, 0, 1, 4, 0, 2, 5, 0] } }) as StopTimeIndex;
        const vehicleAt = vehicle('trip-1', { delay: null, last_stop_id: 'B', state_position: 'on_track', origin_timestamp: at((10 * 60 + 3) * MIN) }, HALFWAY_AB);

        expect(estimateDelay(vehicleAt, night, TZ)).toBe(180);
    });

    it('has no delay for a trip missing from the slice', () => {
        expect(estimateDelay(vehicle('trip-2', { last_stop_id: 'B', origin_timestamp: at(0) }), index, TZ)).toBeNull();
    });

    it('has no delay for a trip the slice lists without calls', () => {
        const empty = indexStopTimeSlice({ ...slice, trips: { 'trip-1': [] } }) as StopTimeIndex;
        expect(estimateDelay(vehicle('trip-1', { state_position: 'before_track', origin_timestamp: at(0) }), empty, TZ)).toBeNull();
        expect(estimateDelay(vehicle('constructor', { state_position: 'before_track', origin_timestamp: at(0) }), index, TZ)).toBeNull();
    });

    // A vehicle hours off its timetable is on another trip or parked.
    it('drops an estimate beyond the plausible maximum', () => {
        expect(estimateDelay(onTrip(120 * MIN, 'B', 'on_track'), index, TZ)).toBeNull();
    });
});

// The estimate reaches every consumer as a trip patch; the push channel stays the authority.
describe('withEstimatedPatches', () => {
    const estimated = onTrip(-7 * MIN, 'B', 'on_track');
    const collection: VehicleCollection = { type: 'FeatureCollection', features: [estimated] };
    const estimates = estimateFleetDelays(collection, index, TZ, NOW);

    it('adds a trip patch with the estimated delay', () => {
        const result = withEstimatedPatches(estimates, new Map(), new Map());

        expect(result.get('trip-1')).toMatchObject({ tripId: 'trip-1', delay: 60, receivedAt: NOW });
    });

    it('leaves a vehicle with a fresh push patch to the push channel', () => {
        const pushed = new Map([['veh-trip-1', patch({ vehicleId: 'veh-trip-1', delay: 300 })]]);
        const byTripId = new Map();

        expect(withEstimatedPatches(estimates, byTripId, pushed)).toBe(byTripId);
    });

    it('estimates a vehicle whose fresh push patch carries no delay, keeping the patch\'s other fields', () => {
        const noDelay = new Map([['veh-trip-1', patch({ vehicleId: 'veh-trip-1', delay: null, is_wheelchair_accessible: true, run_number: '14613' })]]);

        expect(withEstimatedPatches(estimates, new Map(), noDelay).get('trip-1'))
            .toMatchObject({ delay: 60, is_wheelchair_accessible: true, run_number: '14613', isEstimate: true });
    });

    it('estimates over a push patch gone silent', () => {
        const silent = new Map([['veh-trip-1', patch({ vehicleId: 'veh-trip-1', delay: 300, receivedAt: NOW - 5 * MIN })]]);

        expect(withEstimatedPatches(estimates, new Map(), silent).get('trip-1')?.delay).toBe(60);
    });
});

// The detail tells the rider whether the delay is live from the vehicle or an estimate.
describe('delaySourceOf', () => {
    it('is live for a push patch, estimated for the app\'s or the backend\'s estimate, standard elsewhere', () => {
        expect(delaySourceOf({ is_enriched: true }, true)).toBe('live');
        expect(delaySourceOf({ is_delay_estimated: true }, true)).toBe('estimated');
        expect(delaySourceOf({}, true)).toBe('estimated');
        expect(delaySourceOf({}, false)).toBe('standard');
    });
});
