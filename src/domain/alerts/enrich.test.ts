import { describe, expect, it } from 'vitest';
import type { RSSItem, RouteInfo } from '@/types';
import { NOW, at } from '@/test/factories';
import { ALERT_RULES } from '@shared/alerts';
import { resolveAlertLines, withAlertTiming } from './enrich';

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

describe('withAlertTiming', () => {
    const timed = (overrides: Partial<RSSItem>) => withAlertTiming([{ ...alert([]), ...overrides }], NOW)[0];
    const longAgo = at(-ALERT_RULES.INCIDENT_STALE_AFTER_MS - 1);

    // A stale incident stays listed as active but no longer counts as a disruption; a long exclusion is never stale.
    it('marks only open-ended incidents past the limit as stale', () => {
        expect(timed({ type: 'incident', valid_from: longAgo })).toMatchObject({ isActive: true, isFuture: false, isStale: true });
        expect(timed({ type: 'exclusion', valid_from: longAgo })).toMatchObject({ isActive: true, isStale: false });
        expect(timed({ type: 'incident', valid_from: at(1) })).toMatchObject({ isActive: false, isFuture: true, isStale: false });
    });
});
