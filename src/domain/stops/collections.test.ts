import { describe, expect, it } from 'vitest';
import { stopModel } from '@/test/factories';
import { favoriteStopsIn, historyWithStops, lineColorAt, mapStopsOf, pinnedStops, pinsOf } from './collections';

const pin = (stopId: string, city = 'brno') => ({ city, stopId });

const model = stopModel([
    { id: 'S1', platforms: [{ id: 'U1Z1', aliases: ['U1Z1P'], routes: ['T9'] }, { id: 'U1Z2', routes: ['MA'] }] },
    { id: 'S2', platforms: [{ id: 'U2Z1', routes: ['B67'] }] },
    { id: 'S3', platforms: [{ id: 'U3Z1', alightOnly: true }] },
], [{ id: 'E1', station: 'S1', name: 'Vstup', pos: [14.42, 50.08] }]);

describe('pinnedStops', () => {
    // A pin can name an alias or a pre-stops.json PID id; unpinning and reordering must write that id back.
    it('keeps each pin\'s own id next to the stop it opens', () => {
        expect(pinnedStops(model, [pin('S2'), pin('U1Z1P'), pin('gone')]).map(p => [p.pin.stopId, p.pins.length, p.stop.id])).toEqual([
            ['S2', 1, 'S2'],
            ['U1Z1P', 1, 'U1Z1'],
        ]);
    });

    // Unpinning the one card must remove every id it was pinned under, or the card stays.
    it('lists a stop pinned under two of its ids once, at its first pin, with both ids', () => {
        expect(pinnedStops(model, [pin('U1Z1P'), pin('U1Z1')]).map(p => [p.pin.stopId, p.pins.map(x => x.stopId)])).toEqual([['U1Z1P', ['U1Z1P', 'U1Z1']]]);
    });

    it('finds the pins that open a stop, whichever id they were made under', () => {
        expect(pinsOf(model, [pin('U1Z1P'), pin('S2'), pin('U1Z1,U1Z1P')], 'U1Z1').map(p => p.stopId)).toEqual(['U1Z1P', 'U1Z1,U1Z1P']);
        expect(pinsOf(null, [pin('U1Z1')], 'U1Z1')).toHaveLength(1);
    });
});

describe('favoriteStopsIn', () => {
    // Stop ids repeat across networks (Prešov's are plain numbers), so a pin counts only in its own city.
    it('keeps a city\'s own pins, never another city\'s with the same id', () => {
        expect(favoriteStopsIn([pin('S2'), pin('S2', 'presov')], 'brno')).toEqual([pin('S2')]);
    });
});

describe('lineColorAt', () => {
    // One line number can name different routes across a region's towns; the stop's own list is the one that serves it.
    it('takes the colour the stop records for the line', () => {
        expect(lineColorAt(model.byId.get('U2Z1'), '67')).toBe('#007DA8');
        expect(lineColorAt(model.byId.get('U2Z1'), '5')).toBeUndefined();
    });
});

describe('mapStopsOf', () => {
    // An alight-only stop has no departures to open.
    it('draws stations, platforms and entrances, leaving out alight-only stops', () => {
        const { stations, platforms } = mapStopsOf(model, []);
        expect(stations.map(s => s.id)).toEqual(['S1', 'S2']);
        expect(platforms.map(p => p.id)).toEqual(['U1Z1', 'U1Z2', 'U2Z1', 'E1']);
    });

    it('keeps only stops of the filtered modes', () => {
        const { stations, platforms } = mapStopsOf(model, ['metro']);
        expect(stations.map(s => s.id)).toEqual(['S1']);
        expect(platforms.map(p => p.id)).toEqual(['U1Z2']);
    });
});

describe('historyWithStops', () => {
    const history = [
        { type: 'stop' as const, city_slug: 'brno', stop_id: 'U1Z1P', stop_name: 'Old name', timestamp: 1 },
        { type: 'stop' as const, city_slug: 'prague', stop_id: 'U1Z1', stop_name: 'Elsewhere', timestamp: 2 },
        { type: 'line' as const, lines: ['9'], timestamp: 3 },
    ];

    // A recent stop shows today's name, platform and lines, however long ago it was searched.
    it('reads the selected city\'s stops from today\'s stop list and keeps the others as stored', () => {
        const shown = historyWithStops(history, model, 'brno');
        expect(shown[0]).toMatchObject({ stop_name: 'Old name', stop: { id: 'U1Z1', name: 'S1' } });
        expect(shown[1]).toBe(history[1]);
        expect(shown[2]).toBe(history[2]);
    });

    it('returns the history itself when no stop resolves', () => {
        expect(historyWithStops(history, null, 'brno')).toBe(history);
    });
});
