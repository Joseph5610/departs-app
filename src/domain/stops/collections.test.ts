import { describe, expect, it } from 'vitest';
import type { StopCollection, StopFeature } from '@/types';
import { indexStopsById, lineColorAt, pinnedStops, selectedStopOf, splitStopCollection } from './collections';

const stop = (stop_id: string, properties: Partial<StopFeature['properties']> = {}): StopFeature => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [14.42, 50.08] },
    properties: { stop_id, stop_name: stop_id, ...properties } as StopFeature['properties'],
});

const collection = (...features: StopFeature[]): StopCollection => ({ type: 'FeatureCollection', features });

describe('indexStopsById', () => {
    // Links and departures name any platform id; each must open the stop the map draws.
    it('resolves a station and its platforms ids, letting a platform listed after it keep its own entry', () => {
        const station = stop('S1', { all_ids: ['U1Z1', 'U1Z2'], is_station: true });
        const platform = stop('U1Z2');
        const index = indexStopsById(collection(station, platform));

        expect(index.get('S1')).toBe(station);
        expect(index.get('U1Z1')).toBe(station);
        expect(index.get('U1Z2')).toBe(platform);
    });
});

describe('pinnedStops', () => {
    // A pin can name a platform of a merged station; unpinning and reordering must write that id back.
    it('keeps each pin\'s own id next to the stop it resolves to', () => {
        const station = stop('U1Z1,U1Z2', { all_ids: ['U1Z1', 'U1Z2'] });
        const other = stop('S2');
        const index = indexStopsById(collection(station, other));

        expect(pinnedStops(index, ['S2', 'U1Z1', 'gone'])).toEqual([
            { id: 'S2', ids: ['S2'], feature: other },
            { id: 'U1Z1', ids: ['U1Z1'], feature: station },
        ]);
    });

    // Unpinning the one card must remove every id it was pinned under, or the card stays.
    it('lists a stop pinned under two of its ids once, at its first pin, with both ids', () => {
        const station = stop('U1Z1,U1Z2', { all_ids: ['U1Z1', 'U1Z2'] });
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
    // Drop-off-only platforms have no departures to open.
    it('separates platforms from stations and leaves out drop-off-only stops', () => {
        const { platforms, stations } = splitStopCollection(collection(
            stop('P1'),
            stop('P2', { is_drop_off_only: true }),
            stop('station-S1', { is_station: true }),
            stop('station-S2', { is_station: true, is_drop_off_only: true }),
        ));

        expect(platforms?.features.map((f) => f.properties.stop_id)).toEqual(['P1']);
        expect(stations?.features.map((f) => f.properties.stop_id)).toEqual(['station-S1']);
    });
});

describe('selectedStopOf', () => {
    const bus = { name: '67', type: 'bus' as const, route_color: '#007DA8' };
    const tram = { name: '4', type: 'tram' as const, route_color: '#7A0603' };
    const index = indexStopsById(collection(
        stop('Z1', { stop_name: 'Moravanské lány', lines: [bus] }),
        stop('Z3', { stop_name: 'Moravanské lány', lines: [tram, bus] }),
    ));

    it('is the stop list\'s own entry for a known id', () => {
        expect(selectedStopOf('Z1', index)).toMatchObject({ stop_id: 'Z1', stop_name: 'Moravanské lány' });
    });

    // A board section opened as one stop keeps its comma-joined id, so the board asks for all its platforms.
    it('gathers a comma-joined id of several platforms into one stop', () => {
        expect(selectedStopOf('Z1,Z3', index)).toMatchObject({
            stop_id: 'Z1,Z3', stop_name: 'Moravanské lány', all_ids: ['Z1', 'Z3'], platform_count: 2, lines: [bus, tram],
        });
    });

    it('is just the id when the stop list knows none of it', () => {
        expect(selectedStopOf('X9', index)).toEqual({ stop_id: 'X9' });
    });
});
