import { describe, expect, it } from 'vitest';
import { mergePersisted, usePreferencesStore } from './preferencesStore';

const defaults = usePreferencesStore.getState();
const stop = (stop_id: string, timestamp: number) => ({ type: 'stop', timestamp, stop_id, stop_name: stop_id, coordinates: [14.4, 50.1] });

// A stored value from an older app version or a corrupted write must fall back, never crash the app on start.
describe('mergePersisted', () => {
    it('keeps valid history entries, drops corrupt ones and repeats of the same search', () => {
        const merged = mergePersisted({
            searchHistory: [stop('U1', 2), { type: 'stop', stop_id: 'broken' }, stop('U1', 1), { type: 'line', timestamp: 3, lines: ['22'] }, 'junk'],
        }, defaults);

        expect(merged.searchHistory.map((item) => (item.type === 'stop' ? item.stop_id : item.type))).toEqual(['U1', 'line']);
    });

    it('drops malformed favourite lines and keeps well-formed ones', () => {
        const merged = mergePersisted({
            favoriteLines: [{ city: 'prague', stopId: 'U1', line: '22', headsign: 'Bílá Hora' }, { city: 'prague', line: 22 }],
        }, defaults);

        expect(merged.favoriteLines).toEqual([{ city: 'prague', stopId: 'U1', line: '22', headsign: 'Bílá Hora' }]);
    });

    it('falls back for values of the wrong type or outside the allowed options', () => {
        const merged = mergePersisted({ refreshIntervalS: 7, showStops: 'yes', favoriteStops: [1, 2], departureSort: 'line' }, defaults);

        expect(merged).toMatchObject({ refreshIntervalS: defaults.refreshIntervalS, showStops: defaults.showStops, favoriteStops: defaults.favoriteStops, departureSort: 'line' });
    });

    it('ignores a stored value that is not an object at all', () => {
        expect(mergePersisted('corrupt', defaults)).toBe(defaults);
    });
});
