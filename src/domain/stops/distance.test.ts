import { describe, expect, it } from 'vitest';
import type { StopFeature } from '@/types';
import { nearestStops } from './distance';

const HERE: [number, number] = [14.42, 50.08];

/** A stop `northM` metres north of HERE. */
const stop = (stop_id: string, stop_name: string, northM: number, properties: Partial<StopFeature['properties']> = {}): StopFeature => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [HERE[0], HERE[1] + northM / 111_195] },
    properties: { stop_id, stop_name, location_type: 0, lines: [{ name: '17', type: 'tram', route_color: '#7A0603' }], ...properties },
});

const ids = (features: StopFeature[], limit = 10, maxM = 1000) =>
    nearestStops(features, HERE, limit, maxM).map(n => n.feature.properties.stop_id);

describe('nearestStops', () => {
    it('lists stops in range nearest first, up to the limit', () => {
        const stops = [stop('far', 'Far', 900), stop('near', 'Near', 100), stop('mid', 'Mid', 400), stop('out', 'Out', 1200)];
        expect(ids(stops)).toEqual(['near', 'mid', 'far']);
        expect(ids(stops, 2)).toEqual(['near', 'mid']);
    });

    // A station's platforms share a name; the home sheet must list the station once.
    it('lists platforms of one name once, at the nearest platform', () => {
        const stops = [stop('A2', 'Vltavská', 300), stop('A1', 'Vltavská', 120), stop('B', 'Tusarova', 200)];
        expect(nearestStops(stops, HERE, 10, 1000).map(n => [n.feature.properties.stop_id, Math.round(n.distance)]))
            .toEqual([['A1', 120], ['B', 200]]);
    });

    // Stations and entrances are not platforms one boards at, so they must not crowd out real stops.
    it('skips stations, entrances and other stops without lines', () => {
        const stops = [
            stop('station-A', 'Vltavská', 10, { is_station: true, lines: [] }),
            stop('A-E6', 'E6', 5, { location_type: 2, lines: undefined }),
            stop('A1', 'Vltavská', 40),
        ];
        expect(ids(stops)).toEqual(['A1']);
    });

    it('skips drop-off-only stops and needs a location', () => {
        const stops = [stop('d', 'Drop', 50, { is_drop_off_only: true }), stop('s', 'Stop', 60)];
        expect(ids(stops)).toEqual(['s']);
        expect(nearestStops(stops, null, 10, 1000)).toEqual([]);
    });
});
