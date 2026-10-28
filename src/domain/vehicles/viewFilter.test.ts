import { describe, expect, it } from 'vitest';
import type { AppVehicleCollection } from '@shared/api';
import { vehicle } from '@/test/factories';
import { withPositions } from './viewFilter';

describe('withPositions', () => {
    // Golemio can send a vehicle whose position failed to parse; the map and animation can't place it.
    it('drops vehicles sent without a position', () => {
        const placed = vehicle('trip-1');
        const collection: AppVehicleCollection = { type: 'FeatureCollection', features: [placed, { ...vehicle('trip-2'), geometry: null }] };

        expect(withPositions(collection).features).toEqual([placed]);
    });

    it('drops vehicles at the feeds\' [0, 0] placeholder', () => {
        const placed = vehicle('trip-1');
        const origin = { ...vehicle('trip-2'), geometry: { type: 'Point' as const, coordinates: [0, 0] as [number, number] } };

        expect(withPositions({ type: 'FeatureCollection', features: [placed, origin] }).features).toEqual([placed]);
    });

    it('returns the same collection when every vehicle is placed', () => {
        const collection: AppVehicleCollection = { type: 'FeatureCollection', features: [vehicle('trip-1')] };

        expect(withPositions(collection)).toBe(collection);
    });
});
