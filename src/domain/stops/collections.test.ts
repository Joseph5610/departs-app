import { describe, expect, it } from 'vitest';
import type { StopCollection, StopFeature } from '@/types';
import { indexStopsById, splitStopCollection } from './collections';

const stop = (stop_id: string, properties: Partial<StopFeature['properties']> = {}): StopFeature => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [14.42, 50.08] },
    properties: { stop_id, stop_name: stop_id, ...properties } as StopFeature['properties'],
});

const collection = (...features: StopFeature[]): StopCollection => ({ type: 'FeatureCollection', features });

describe('indexStopsById', () => {
    // Links and departures name any platform id; each must open the stop the map draws.
    it('resolves sub-ids and the parts of a merged station id, letting a platform keep its own entry', () => {
        const station = stop('U1Z1,U1Z2,U1Z3', { all_ids: ['U1'] });
        const ownPlatform = stop('U1Z2');
        const index = indexStopsById(collection(ownPlatform, station));

        expect(index.get('U1')).toBe(station);
        expect(index.get('U1Z1')).toBe(station);
        expect(index.get('U1Z2')).toBe(ownPlatform);
    });
});

describe('splitStopCollection', () => {
    // Drop-off-only platforms have no departures to open; station dots come from centroids when the feed has them.
    it('separates platforms from station centroids and leaves out drop-off-only stops', () => {
        const { stops, centroids } = splitStopCollection(collection(
            stop('P1'),
            stop('P2', { is_drop_off_only: true }),
            stop('centroid-S1', { is_centroid: true }),
        ));

        expect(stops?.features.map((f) => f.properties.stop_id)).toEqual(['P1']);
        expect(centroids?.features.map((f) => f.properties.stop_id)).toEqual(['centroid-S1']);
    });
});
