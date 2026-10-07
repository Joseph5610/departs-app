import { describe, expect, it } from 'vitest';
import { DEFAULT_LINE_RULES, type LineRules } from '@/config/cities';
import { departure, feeder } from '@/test/factories';
import { DEPARTURES_CONFIG } from '@/config/constants';
import { distinctLines, lineChips, summarizeFeeders } from './lines';
import { visibleInGroup } from './grouping';

const chip = (name: string, type: string) => ({ name, type, route_color: '' });

describe('lineChips', () => {
    // Prague night lines (9x trams, 9xx buses) go after their mode's day lines; S/R lines count as trains.
    it('orders metro, trains, then modes with night lines last, one chip per line', () => {
        const rules: LineRules = { ...DEFAULT_LINE_RULES, isNightLine: (_type, name) => /^9\d{1,2}$/.test(name) };
        const chips = lineChips([
            chip('907', 'bus'), chip('22', 'tram'), chip('S7', 'unknown'), chip('136', 'bus'),
            chip('91', 'tram'), chip('B', 'metro'), chip('9', 'tram'), chip('22', 'tram'),
        ], rules);

        expect(chips.map((c) => c.name)).toEqual(['B', 'S7', '9', '22', '136', '91', '907']);
    });
});

describe('summarizeFeeders', () => {
    // A held minute or more is worth saying; missed feeders outrank a hold.
    it('lists missed feeders and the longest hold of a minute or more', () => {
        expect(summarizeFeeders([
            feeder({ line: '9', hold_s: 45 }),
            feeder({ line: '22', hold_s: 150 }),
            feeder({ line: '17', hold_s: 90 }),
            feeder({ line: '3', will_miss: true, hold_s: 400 }),
        ])).toMatchObject({ missed: ['3'], held: { line: '22' }, heldMinutes: 3 });

        expect(summarizeFeeders([feeder({ hold_s: 30 })])).toMatchObject({ missed: [], held: null });
    });
});

describe('distinctLines', () => {
    it('keeps the first colour of each line in first-seen order', () => {
        expect(distinctLines([{ line: '22', route_color: 'A' }, { line: '9' }, { line: '22', route_color: 'B' }])).toEqual([['22', 'A'], ['9', '']]);
    });
});

describe('visibleInGroup', () => {
    const deps = (n: number) => Array.from({ length: n }, (_, i) => departure({ tripId: `t${i}` }));
    const perGroup = DEPARTURES_CONFIG.VISIBLE_PER_GROUP;

    // An expand button for a single hidden row costs as much space as the row itself.
    it('shows a lone extra departure instead of hiding it behind a button', () => {
        expect(visibleInGroup(deps(perGroup + 1), false, false)).toMatchObject({ hiddenCount: 0, hasMore: false });
        expect(visibleInGroup(deps(perGroup + 2), false, false)).toMatchObject({ hiddenCount: 2, hasMore: true });
    });

    it('shows everything when expanded, and never offers more on a filtered board', () => {
        expect(visibleInGroup(deps(perGroup + 2), true, false)).toMatchObject({ hiddenCount: 0, hasMore: true });
        expect(visibleInGroup(deps(perGroup + 2), true, true)).toMatchObject({ hiddenCount: 0, hasMore: false });
    });
});
