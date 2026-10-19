import { describe, expect, it } from 'vitest';
import { stopModel } from '@/test/factories';
import { createSearchIndex, searchStops } from './search';

const model = stopModel([{ id: 'S1', name: 'Anděl', platforms: [{ id: 'U1040Z1P' }] }]);
const index = createSearchIndex([...model.stations, ...model.platforms]);

describe('searchStops', () => {
    // A name opens the whole station's board, not one of its platforms.
    it('returns the station rather than a platform of the same name', () => {
        expect(searchStops(index, 'Anděl').map(s => s.id)).toEqual(['S1']);
    });

    it('still finds a platform by its id', () => {
        expect(searchStops(index, 'U1040Z1')[0]?.id).toBe('U1040Z1P');
    });
});
