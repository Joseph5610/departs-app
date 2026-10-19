import { describe, expect, it } from 'vitest';
import { stopModel, stopTime } from '@/test/factories';
import { boardableStopId, indexStops } from './twins';

const AT: [number, number] = [14.42, 50.08];
const NEAR: [number, number] = [14.4205, 50.0801];

const model = stopModel([
    { id: 'S', name: 'Sídliště', pos: AT, platforms: [{ id: 'S-arr', alightOnly: true }, { id: 'S-dep', routes: ['B67'] }] },
    { id: 'T', name: 'Smyčka', pos: AT, platforms: [{ id: 'T-arr', alightOnly: true }] },
    { id: 'U', name: 'Smyčka', pos: NEAR, platforms: [{ id: 'U-dep', routes: ['T9'] }] },
]);
const grids = [indexStops(model.stations.filter(s => !s.alightOnly), 250), indexStops(model.platforms.filter(p => !p.alightOnly), 250)] as const;
const open = (stopId: string, name: string, coordinates: [number, number] = AT) =>
    boardableStopId({ ...stopTime(1, '12:00:00', { stop_id: stopId, stop_name: name }), geometry: { type: 'Point', coordinates } }, model, ...grids);

describe('boardableStopId', () => {
    it('opens a timeline stop that has departures itself', () => {
        expect(open('S-dep', 'Sídliště')).toBe('S-dep');
    });

    // A terminus platform is kept for alighting only; its station's board has the onward departures.
    it('opens the station of an arrival-only platform, whatever name the trip gives it', () => {
        expect(open('S-arr', 'Sídliště, konečná')).toBe('S');
    });

    // A platform alias may equal its station's id; the station is still the board an arrival-only platform opens.
    it('finds the station even where a platform alias shares its id', () => {
        const shadowed = stopModel([{ id: 'S', name: 'Sídliště', platforms: [{ id: 'S-arr', alightOnly: true }, { id: 'S-dep', aliases: ['S'], routes: ['B67'] }] }]);
        const stopAt = { ...stopTime(1, '12:00:00', { stop_id: 'S-arr', stop_name: 'Jinak' }), geometry: { type: 'Point' as const, coordinates: AT } };
        expect(boardableStopId(stopAt, shadowed, ...grids)).toBe('S');
    });

    it('falls back to a nearby same-named stop where the whole station is arrival-only, or the list lacks the stop', () => {
        expect(open('T-arr', 'Smyčka')).toBe('U');
        expect(open('X1', 'Smyčka', NEAR)).toBe('U');
    });
});
