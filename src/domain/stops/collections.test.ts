import { describe, expect, it } from 'vitest';
import type { StopCollection, StopFeature } from '@/types';
import { indexStopsById, lineColorAt, pinnedStops, splitStopCollection } from './collections';

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

describe('pinnedStops', () => {
    // A pin can name a platform of a merged station; unpinning and reordering must write that id back.
    it('keeps each pin\'s own id next to the stop it resolves to', () => {
        const station = stop('U1Z1,U1Z2');
        const other = stop('S2');
        const index = indexStopsById(collection(station, other));

        expect(pinnedStops(index, ['S2', 'U1Z1', 'gone'])).toEqual([
            { id: 'S2', ids: ['S2'], feature: other },
            { id: 'U1Z1', ids: ['U1Z1'], feature: station },
        ]);
    });

    // Unpinning the one card must remove every id it was pinned under, or the card stays.
    it('lists a stop pinned under two of its ids once, at its first pin, with both ids', () => {
        const station = stop('U1Z1,U1Z2');
        const index = indexStopsById(collection(station));

        expect(pinnedStops(index, ['U1Z2', 'U1Z1'])).toEqual([{ id: 'U1Z2', ids: ['U1Z2', 'U1Z1'], feature: station }]);
    });
});

describe('lineColorAt', () => {
    // One line number can name different routes across a region's towns; the stop's own list is the one that serves it.
    it('takes the colour the stop records for the line', () => {
        const at = stop('S1', { lines: [{ name: '1', type: 'tram', route_color: '#E30613' }, { name: '9', type: 'bus', route_color: '#0080C8' }] });
        expect(lineColorAt(at, '9')).toBe('#0080C8');
        expect(lineColorAt(at, '5')).toBeUndefined();
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
