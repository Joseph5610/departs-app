import { describe, expect, it } from 'vitest';
import type { StopFeature } from '@/types';
import { createSearchIndex, searchStops } from './search';

const stop = (stop_id: string, properties: Partial<StopFeature['properties']> = {}): StopFeature => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [14.4, 50.07] },
    properties: { stop_id, stop_name: 'Anděl', location_type: 0, ...properties },
});

describe('searchStops', () => {
    // A name opens the whole station's board, not one of its platforms.
    it('returns the station rather than a platform of the same name', () => {
        const index = createSearchIndex([stop('U1040Z1P'), stop('S1', { location_type: 1, is_centroid: true }), stop('E1', { location_type: 2 })]);
        expect(searchStops(index, 'Anděl').map(s => s.properties.stop_id)).toEqual(['S1']);
    });

    it('still finds a platform by its id', () => {
        const index = createSearchIndex([stop('U1040Z1P'), stop('S1', { location_type: 1, is_centroid: true })]);
        expect(searchStops(index, 'U1040Z1')[0]?.properties.stop_id).toBe('U1040Z1P');
    });
});
