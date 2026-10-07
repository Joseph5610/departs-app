import { describe, expect, it } from 'vitest';
import type { Departure, RouteInfo, VehicleFeature } from '@/types';
import { routeJoinKey } from '@/domain/routes/routeType';
import { MIN, NOW, at, departure, feeder, indexBy, patch, vehicle } from '@/test/factories';
import { enrichLiveDepartures } from './enrich';
import type { PatchIndex } from '@/domain/realtime/patches';

interface Inputs {
    vehicles?: VehicleFeature[];
    byTripId?: PatchIndex;
    byVehicleId?: PatchIndex;
    routes?: RouteInfo[];
}

const enrich = (departures: Departure[], { vehicles = [], byTripId = new Map(), byVehicleId = new Map(), routes = [] }: Inputs = {}) =>
    enrichLiveDepartures(
        departures,
        indexBy(vehicles, (v) => v.properties.gtfs_trip_id),
        byTripId,
        byVehicleId,
        new Map(routes.map((r) => [routeJoinKey(r.type, r.name), r])),
        new Map(),
        NOW,
    );

// The live pipeline every fetched departure goes through before the board shows it.
describe('enrichLiveDepartures', () => {
    it('applies a fresh push delay and moves the countdown timestamp with it', () => {
        const [result] = enrich([departure()], { byTripId: new Map([['trip-1', patch({ tripId: 'trip-1', delay: 120 })]]) });

        expect(result).toMatchObject({ delay: 120, timestamp: at(7 * MIN), is_enriched: true });
    });

    it('ignores a push patch older than the silence TTL', () => {
        const stale = patch({ tripId: 'trip-1', delay: 120, receivedAt: NOW - 5 * MIN });
        const [result] = enrich([departure()], { byTripId: new Map([['trip-1', stale]]) });

        expect(result.delay).toBe(0);
        expect(result.timestamp).toBe(at(5 * MIN));
    });

    // The departures API often lacks the vehicle id; the live stream supplies it, which unlocks vehicle-keyed patches.
    it('takes the vehicle from the live stream and matches its vehicle patch', () => {
        const [result] = enrich([departure()], {
            vehicles: [vehicle('trip-1')],
            byVehicleId: new Map([['veh-trip-1', patch({ vehicleId: 'veh-trip-1', delay: 60 })]]),
        });

        expect(result.vehicleId).toBe('veh-trip-1');
        expect(result.delay).toBe(60);
    });

    it('drops a departure past the grace period unless its delay keeps it ahead', () => {
        const gone = departure({ tripId: 'gone', scheduled: at(-3 * MIN), timestamp: at(-3 * MIN) });
        const late = departure({ tripId: 'late', scheduled: at(-3 * MIN), timestamp: at(-3 * MIN) });
        const result = enrich([gone, late], { byTripId: new Map([['late', patch({ tripId: 'late', delay: 240 })]]) });

        expect(result.map((d) => d.tripId)).toEqual(['late']);
    });

    // hold = on-time hold + feeder's live delay, floored at 0; past max_wait the departure won't wait.
    it('computes each feeder hold from its live delay and flags one that will miss', () => {
        const [result] = enrich(
            [departure({ connections: [feeder({ trip_id: 'on-time' }), feeder({ trip_id: 'late' }), feeder({ trip_id: 'early' }), feeder({ trip_id: 'not-running' })] })],
            { vehicles: [vehicle('on-time', { delay: 0 }), vehicle('late', { delay: 300 }), vehicle('early', { delay: -120 })] },
        );

        expect(result.connections?.map(({ trip_id, hold_s, will_miss }) => ({ trip_id, hold_s, will_miss }))).toEqual([
            { trip_id: 'on-time', hold_s: 60, will_miss: false },
            { trip_id: 'late', hold_s: 360, will_miss: true },
            { trip_id: 'early', hold_s: 0, will_miss: false },
            { trip_id: 'not-running', hold_s: null, will_miss: false },
        ]);
    });

    // DÚK reuses line numbers across modes, so the routes join is keyed on type + name.
    it('brands a line by mode, so a reused line number keeps its own colour', () => {
        const result = enrich(
            [departure({ tripId: 'bus', line: '70', type: 'bus' }), departure({ tripId: 'trolley', line: '70', type: 'trolleybus' })],
            { routes: [{ name: '70', type: 'bus', route_color: '007DA8' }, { name: '70', type: 'trolleybus', route_color: '80166F' }] },
        );

        expect(result.map((d) => d.route_color)).toEqual(['007DA8', '80166F']);
    });
});
