import { describe, expect, it } from 'vitest';
import type { RouteInfo } from '@/types';
import { alertKeysOfLines } from './pushKeys';

const route = (name: string): RouteInfo => ({ name, type: 'tram', route_color: 'E00' });

describe('alertKeysOfLines', () => {
    // GTFS-RT alerts name a line by route id, RSS by name, KORDIS by its numeric id.
    it('lists a line under its name, route ids and KORDIS numeric id', () => {
        const byId = new Map([['L12D1', route('12')], ['L9', route('9')]]);
        const byName = new Map([['12', route('12')], ['9', route('9')]]);
        expect(alertKeysOfLines(['12', '9'], byId, byName)).toEqual([
            { name: '12', keys: ['12', 'L12D1'] },
            { name: '9', keys: ['9', 'L9'] },
        ]);
    });

    // resolveLine tries names before numeric ids: "99" is day line 99, never night line N99 (L99D99).
    it('leaves out a numeric id another line is named by', () => {
        const byId = new Map([['L99D99', route('N99')], ['L99D1', route('99')]]);
        const byName = new Map([['N99', route('N99')], ['99', route('99')]]);
        expect(alertKeysOfLines(['N99'], byId, byName)).toEqual([{ name: 'N99', keys: ['N99', 'L99D99'] }]);
    });

    // resolveLine tries ids first: Prague's rail line named "L4" must not catch tram 4 (route id L4).
    it('leaves out a name that is another route\'s id', () => {
        const byId = new Map([['L4', route('4')], ['L1264', route('L4')]]);
        const byName = new Map([['4', route('4')], ['L4', route('L4')]]);
        expect(alertKeysOfLines(['L4'], byId, byName)).toEqual([{ name: 'L4', keys: ['L1264'] }]);
        expect(alertKeysOfLines(['4'], byId, byName)).toEqual([{ name: '4', keys: ['4', 'L4'] }]);
    });

    it('leaves out a line with nothing to be named by, so the server never refuses the rest', () => {
        const byId = new Map([['L4', route('4')]]);
        expect(alertKeysOfLines(['l4', '4'], byId, new Map())).toEqual([{ name: '4', keys: ['4', 'L4'] }]);
    });

    it('keeps a line routes.json does not know under its name alone', () => {
        expect(alertKeysOfLines(['X1'], new Map(), new Map())).toEqual([{ name: 'X1', keys: ['X1'] }]);
    });
});
