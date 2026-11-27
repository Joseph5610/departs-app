import { describe, expect, it } from 'vitest';
import type { VehicleCollection } from '@/types';
import { vehicle } from '@/test/factories';
import { twinVehicleOf, withoutTwinVehicles } from './twins';

const RULE = { radiusM: 500, maxDelayGapS: 180 };
const AT: [number, number] = [14.25, 50.4];
/** About 110 m north of `AT`. */
const NEAR: [number, number] = [14.25, 50.401];
/** About 2.2 km north of `AT`. */
const FAR: [number, number] = [14.25, 50.42];
const collection = (...features: ReturnType<typeof vehicle>[]): VehicleCollection => ({ type: 'FeatureCollection', features });
const bus = (trip: string, line: string, at: [number, number], delay: number | null = 60) =>
    vehicle(trip, { route_short_name: line, route_type: 'bus', delay }, at);

describe('withoutTwinVehicles', () => {
    // PID and DÚK both report the regional lines between them.
    it('leaves out the other network\'s vehicle of the same line near one the selected network shows', () => {
        const own = collection(bus('pid-1', '400', AT));
        expect(withoutTwinVehicles(collection(bus('duk-1', '400', NEAR, 90)), own, RULE)!.features).toEqual([]);
    });

    it('keeps a vehicle of another line, far away, or with a different delay', () => {
        const own = collection(bus('pid-1', '400', AT, 60));
        const other = collection(bus('a', '415', NEAR), bus('b', '400', FAR), bus('c', '400', NEAR, 600));
        expect(withoutTwinVehicles(other, own, RULE)!.features.map(f => f.properties.gtfs_trip_id)).toEqual(['a', 'b', 'c']);
    });

    it('returns the other network\'s collection itself when it holds no twin', () => {
        const other = collection(bus('a', '415', NEAR));
        expect(withoutTwinVehicles(other, collection(bus('pid-1', '400', AT)), RULE)).toBe(other);
    });
});

describe('twinVehicleOf', () => {
    it('finds the other network\'s report of the same vehicle for its panel', () => {
        const others = collection(bus('far', '400', FAR), bus('duk-1', '400', NEAR, 90));
        const own = bus('pid-1', '400', AT).properties;
        expect(twinVehicleOf(own, AT, others, RULE)?.properties.gtfs_trip_id).toBe('duk-1');
    });

    it('finds none without a position or a vehicle of the same line nearby', () => {
        const others = collection(bus('duk-1', '415', NEAR));
        expect(twinVehicleOf(bus('pid-1', '400', AT).properties, AT, others, RULE)).toBeUndefined();
        expect(twinVehicleOf(bus('pid-1', '415', AT).properties, undefined, others, RULE)).toBeUndefined();
    });
});
