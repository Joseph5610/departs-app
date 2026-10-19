import { describe, expect, it } from 'vitest';
import type { Platform } from '@/types';
import { stopModel } from '@/test/factories';
import { nearestStops } from './distance';

const HERE: [number, number] = [14.42, 50.08];

/** A tram 17 platform `northM` metres north of HERE, of a station named `name`. */
const platform = (id: string, name: string, northM: number, extra: { alightOnly?: true; routes?: string[] } = {}) =>
    ({ id: name, name, platforms: [{ id, pos: [HERE[0], HERE[1] + northM / 111_195] as [number, number], routes: ['T17'], ...extra }] });

const platformsOf = (...stations: ReturnType<typeof platform>[]): Platform[] => stopModel(stations).platforms;

const ids = (platforms: Platform[], limit = 10, maxM = 1000) => nearestStops(platforms, HERE, limit, maxM).map(n => n.stop.id);

describe('nearestStops', () => {
    it('lists stops in range nearest first, up to the limit', () => {
        const stops = platformsOf(platform('far', 'Far', 900), platform('near', 'Near', 100), platform('mid', 'Mid', 400), platform('out', 'Out', 1200));
        expect(ids(stops)).toEqual(['near', 'mid', 'far']);
        expect(ids(stops, 2)).toEqual(['near', 'mid']);
    });

    // The home sheet lists a station once, at its nearest platform.
    it('lists each station once, at its nearest platform', () => {
        const stops = stopModel([
            { id: 'V', name: 'Vltavská', platforms: [{ id: 'A2', pos: [HERE[0], HERE[1] + 300 / 111_195], routes: ['T17'] }, { id: 'A1', pos: [HERE[0], HERE[1] + 120 / 111_195], routes: ['T17'] }] },
            { id: 'T', name: 'Tusarova', platforms: [{ id: 'B', pos: [HERE[0], HERE[1] + 200 / 111_195], routes: ['T17'] }] },
        ]).platforms;
        expect(nearestStops(stops, HERE, 10, 1000).map(n => [n.stop.id, Math.round(n.distance)])).toEqual([['A1', 120], ['B', 200]]);
    });

    it('skips platforms no line serves, alight-only ones, and needs a location', () => {
        const stops = platformsOf(platform('none', 'None', 10, { routes: [] }), platform('d', 'Drop', 50, { alightOnly: true }), platform('s', 'Stop', 60));
        expect(ids(stops)).toEqual(['s']);
        expect(nearestStops(stops, null, 10, 1000)).toEqual([]);
    });
});
