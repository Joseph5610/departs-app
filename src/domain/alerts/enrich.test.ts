import { describe, expect, it } from 'vitest';
import type { RSSItem, RouteInfo } from '@/types';
import { resolveAlertLines } from './enrich';

const alert = (lines: string[]): RSSItem => ({ type: 'exclusion', title: 't', description: null, valid_from: null, valid_to: null, link: '', lines });
const route = (name: string, type: RouteInfo['type'], route_color: string): RouteInfo => ({ name, type, route_color });

describe('resolveAlertLines', () => {
    // GTFS-RT alerts name routes by id, RSS ones by line name, KORDIS by its numeric id; an unknown line keeps its raw id.
    it('resolves a line by route id, then name, then KORDIS numeric id', () => {
        const byId = new Map([['L22', route('22', 'tram', 'E00')]]);
        const byName = new Map([['B', route('B', 'metro', 'FD0')]]);
        const byKordisNumeric = new Map([['120', route('E120', 'bus', '00F')]]);

        const [resolved] = resolveAlertLines([alert(['L22', 'b', '120', 'x75'])], byId, byName, byKordisNumeric);

        expect(resolved.resolvedLines).toEqual([
            { name: '22', type: 'tram', route_color: 'E00' },
            { name: 'B', type: 'metro', route_color: 'FD0' },
            { name: 'E120', type: 'bus', route_color: '00F' },
            { name: 'x75', type: 'unknown' },
        ]);
    });
});
