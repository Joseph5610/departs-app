import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MIN, NOW, at, departure } from '@/test/factories';
import { computeDelayStats, favoriteKey, favoriteKeysAt, favoritesFirst, filterDepartures, groupDepartures, groupsHidingTrips, platformSections, withStopPlatforms, isMetroClosed, favoriteLinesIn, favoriteLineNames, favoritesView, moveShown, nextDeparturesOf, reorderShown, withDelayDeltas } from './index';

// AGENTS.md: metro departures group by line + direction, since each direction of A/B/C is its own platform.
describe('groupDepartures', () => {
    it('splits a metro line into one group per direction', () => {
        const groups = groupDepartures([
            departure({ tripId: 'a1', line: 'A', type: 'metro', directionId: '0', headsign: 'Depo Hostivař' }),
            departure({ tripId: 'a2', line: 'A', type: 'metro', directionId: '1', headsign: 'Nemocnice Motol' }),
            departure({ tripId: 'a3', line: 'A', type: 'metro', directionId: '0', headsign: 'Depo Hostivař', scheduled: at(8 * MIN), timestamp: at(8 * MIN) }),
        ], 'line');

        expect(groups.map((g) => [g.lineGroupId, g.subGroups.map((s) => s.departures.map((d) => d.tripId))])).toEqual([
            ['A-0', [['a1', 'a3']]],
            ['A-1', [['a2']]],
        ]);
    });

    // Feeds sometimes flip direction_id within one headsign; those must not show as two separate rows.
    it('merges direction ids that share a headsign', () => {
        const groups = groupDepartures([
            departure({ tripId: 't1', directionId: '0', headsign: 'Bílá Hora' }),
            departure({ tripId: 't2', directionId: '1', headsign: 'Bílá Hora', scheduled: at(9 * MIN), timestamp: at(9 * MIN) }),
        ], 'line');

        expect(groups).toHaveLength(1);
        expect(groups[0].subGroups[0].departures.map((d) => d.tripId)).toEqual(['t1', 't2']);
    });

    it('sorts by mode then natural line number, or purely by time', () => {
        const deps = [
            departure({ tripId: 'bus', line: '136', type: 'bus', scheduled: at(1 * MIN), timestamp: at(1 * MIN) }),
            departure({ tripId: 't22', line: '22', type: 'tram', scheduled: at(2 * MIN), timestamp: at(2 * MIN) }),
            departure({ tripId: 't9', line: '9', type: 'tram', scheduled: at(3 * MIN), timestamp: at(3 * MIN) }),
            departure({ tripId: 'metro', line: 'B', type: 'metro', scheduled: at(4 * MIN), timestamp: at(4 * MIN) }),
        ];

        expect(groupDepartures(deps, 'line').map((g) => g.line)).toEqual(['B', '9', '22', '136']);
        expect(groupDepartures(deps, 'departure').map((g) => g.line)).toEqual(['136', '22', '9', 'B']);
    });
});

describe('favoritesFirst', () => {
    it('pins favourite line directions on top and leads their line with the favourite direction', () => {
        const groups = groupDepartures([
            departure({ tripId: 'x', line: '9', headsign: 'Spojovací', scheduled: at(1 * MIN), timestamp: at(1 * MIN) }),
            departure({ tripId: 'y', line: '22', directionId: '0', headsign: 'Bílá Hora' }),
            departure({ tripId: 'z', line: '22', directionId: '0', headsign: 'Vypich', scheduled: at(2 * MIN), timestamp: at(2 * MIN) }),
        ], 'departure');

        const pinned = favoritesFirst(groups, new Set([favoriteKey('22', 'Bílá Hora')]));

        expect(pinned.map((g) => [g.line, g.subGroups.map((s) => s.headsign)])).toEqual([
            ['22', ['Bílá Hora', 'Vypich']],
            ['9', ['Spojovací']],
        ]);
    });
});

describe('filterDepartures', () => {
    // A persisted "AC only" preference must not empty the board at a stop whose feed has no AC data.
    it('applies the AC preference only where some departure reports AC', () => {
        const noData = [departure({ tripId: 'a' }), departure({ tripId: 'b' })];
        expect(filterDepartures(noData, null, true, false).filtered).toHaveLength(2);

        const withData = [departure({ tripId: 'a', is_air_conditioned: true }), departure({ tripId: 'b', is_air_conditioned: false })];
        expect(filterDepartures(withData, null, true, false).filtered.map((d) => d.tripId)).toEqual(['a']);
    });

    it('matches the selected line case-insensitively', () => {
        const deps = [departure({ tripId: 'x', line: 'X9' }), departure({ tripId: 'n', line: '9' })];
        expect(filterDepartures(deps, 'x9', false, false).filtered.map((d) => d.tripId)).toEqual(['x']);
    });

    it('keeps only the selected platform of a station board', () => {
        const deps = [departure({ tripId: 'a', platform: 'A' }), departure({ tripId: 'b', platform: 'B' })];
        expect(filterDepartures(deps, null, false, false, 'B').filtered.map((d) => d.tripId)).toEqual(['b']);
    });
});

describe('platformSections', () => {
    // A station board reads like its signs: one section per platform, so rows never repeat their platform.
    it('splits rows by platform in natural order, splitting a direction that leaves from two platforms', () => {
        const groups = groupDepartures([
            departure({ tripId: 'b1', line: '9', headsign: 'Řepy', platform: 'B' }),
            departure({ tripId: 'a1', line: '9', headsign: 'Řepy', platform: 'A', scheduled: at(2 * MIN), timestamp: at(2 * MIN) }),
            departure({ tripId: 'x', line: '176', headsign: 'Strahov', platform: '10' }),
            departure({ tripId: 'n', line: '20', headsign: 'Radlická' }),
        ], 'line');
        const sections = platformSections(groups);
        expect(sections.map(s => [s.platform, s.groups.flatMap(g => g.subGroups.flatMap(sub => sub.departures.map(d => d.tripId)))])).toEqual([
            ['10', ['x']],
            ['A', ['a1']],
            ['B', ['b1']],
            [null, ['n']],
        ]);
    });

    // Without platform codes (IDS JMK, DPMP) a station board reads by direction, as the stop signs do.
    it('names platforms without a code by direction, after the coded ones, one section per direction', () => {
        const groups = groupDepartures([
            departure({ tripId: 'g', line: '4', platformDirection: 'Grohova' }),
            departure({ tripId: 'c', line: '9', headsign: 'Lesná', platformDirection: 'Grohova' }),
            departure({ tripId: 'k', line: '12', headsign: 'Komárov', platformDirection: 'Komenského náměstí' }),
            departure({ tripId: '1', line: '6', headsign: 'Starý Lískovec', platform: '1' }),
        ], 'line');
        expect(platformSections(groups).map(s => [s.key, s.platform, s.direction])).toEqual([
            ['1', '1', null],
            ['→Grohova', null, 'Grohova'],
            ['→Komenského náměstí', null, 'Komenského náměstí'],
        ]);
    });
});

describe('withStopPlatforms', () => {
    const stopIndex = new Map([
        ['Z1', { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { stop_id: 'Z1', stop_name: 'Česká', platform_code: '1' } }],
        ['Z2', { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { stop_id: 'Z2', stop_name: 'Česká', direction: 'Grohova' } }],
    ] as const) as never;

    // A GTFS city's station board names the station in stopId and the platform in platformStopId.
    it('fills the platform code, else the direction, from the departure\'s stop', () => {
        const deps = withStopPlatforms([
            departure({ tripId: 'a', stopId: 'S', platformStopId: 'Z1' }),
            departure({ tripId: 'b', stopId: 'S', platformStopId: 'Z2' }),
        ], stopIndex);
        expect(deps.map(d => [d.platform, d.platformDirection])).toEqual([['1', undefined], [undefined, 'Grohova']]);
    });

    it('returns the same list when nothing changes', () => {
        const deps = [departure({ tripId: 'a', platform: 'A', stopId: 'Z1' })];
        expect(withStopPlatforms(deps, stopIndex)).toBe(deps);
    });
});

describe('computeDelayStats', () => {
    // Only realtime departures within the stats window count; the trend follows the summed delay changes.
    it('averages realtime delays in the window and reports a worsening trend', () => {
        const stats = computeDelayStats([
            departure({ tripId: 'a', delay: 120, delayDelta: 60 }),
            departure({ tripId: 'b', delay: 240, delayDelta: 30 }),
            departure({ tripId: 'no-rt', delay: null }),
            departure({ tripId: 'far', delay: 3600, timestamp: at(45 * MIN) }),
        ], NOW);

        expect(stats).toEqual({ averageDelayMin: 3, trend: 'worsening', sampleSize: 2 });
    });

    it('returns null without any realtime departure', () => {
        expect(computeDelayStats([departure({ delay: null })], NOW)).toBeNull();
    });
});

describe('withDelayDeltas', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
    });
    afterEach(() => vi.useRealTimers());

    // Matched on trip + scheduled time, so the same trip at another stop time is a different row.
    it('reports how much a delay moved since the previous fetch', () => {
        const previous = [departure({ delay: 60, lastDelayUpdate: NOW - 2 * MIN })];
        const [changed] = withDelayDeltas([departure({ delay: 150 })], previous, NOW - MIN);
        const [same] = withDelayDeltas([departure({ delay: 60 })], previous, NOW - MIN);
        const [unseen] = withDelayDeltas([departure({ delay: 60, scheduled: at(20 * MIN) })], previous, NOW - MIN);

        expect(changed).toMatchObject({ delayDelta: 90, lastDelayUpdate: NOW });
        expect(same).toMatchObject({ delayDelta: undefined, lastDelayUpdate: NOW - 2 * MIN });
        expect(unseen).toMatchObject({ delayDelta: undefined, lastDelayUpdate: undefined });
    });
});

describe('pinned lines', () => {
    const favorites = [
        { city: 'prague', stopId: 'U1', line: '22', headsign: 'Bílá Hora' },
        { city: 'brno', stopId: 'U1', line: '9', headsign: 'Lesná' },
        { city: 'prague', stopId: 'U2', line: '9', headsign: 'Spojovací' },
    ];

    // The panel shows one city's pins; reordering them must not move another city's.
    it('reorders the shown pins into their own slots, leaving the hidden ones in place', () => {
        const [bilaHora, lesna, spojovaci] = favorites;
        expect(reorderShown(favorites, [spojovaci, bilaHora])).toEqual([spojovaci, lesna, bilaHora]);
    });

    it('moves a pin one place with the keyboard, stopping at either end', () => {
        const [a, b, c] = favorites;
        expect(moveShown(favorites, c, -1)).toEqual([a, c, b]);
        expect(moveShown(favorites, a, -1)).toBe(favorites);
    });

    // A stored list can repeat an id; reordering must never write an empty slot, which would void the whole list.
    it('keeps a repeated pin in place rather than leaving a slot empty', () => {
        expect(reorderShown(['S1', 'S2', 'S1'], ['S2', 'S1'])).toEqual(['S2', 'S1', 'S1']);
    });

    it('lists only this city\'s pinned lines', () => {
        expect(favoriteLinesIn(favorites, 'brno')).toEqual([favorites[1]]);
    });

    it('splits lines and stops into tabs only when both are pinned', () => {
        const lines = [favorites[0]];
        expect(favoritesView(lines, ['S1'], 'stops')).toEqual({ hasTabs: true, lines: [], stops: ['S1'] });
        expect(favoritesView(lines, [], 'stops')).toEqual({ hasTabs: false, lines, stops: [] });
    });

    it('returns the same list when the order is unchanged', () => {
        expect(reorderShown(favorites, [favorites[0], favorites[2]])).toBe(favorites);
    });

    // Stop ids repeat across networks, so a pin only counts in the city it was made in.
    it('keys only the pins of this stop in this city', () => {
        expect(favoriteKeysAt(favorites, 'prague', 'U1')).toEqual([favoriteKey('22', 'Bílá Hora')]);
    });

    it('lists a pinned line\'s next departures in its own direction, soonest first', () => {
        const next = nextDeparturesOf([
            departure({ tripId: 'later', timestamp: at(9 * MIN) }),
            departure({ tripId: 'other-way', headsign: 'Vypich', timestamp: at(1 * MIN) }),
            departure({ tripId: 'sooner', timestamp: at(2 * MIN) }),
        ], '22', 'Bílá Hora', 2);

        expect(next.map((d) => d.tripId)).toEqual(['sooner', 'later']);
    });
});

describe('groupsHidingTrips', () => {
    // A trip opened from a timeline, ridden or followed must be visible, not folded behind "more".
    it('names the groups whose collapsed rows hide a marked trip', () => {
        const deps = Array.from({ length: 6 }, (_, i) => departure({ tripId: `t${i}`, scheduled: at(i * MIN), timestamp: at(i * MIN) }));
        const groups = groupDepartures(deps, 'line');

        expect(groupsHidingTrips(groups, new Set(['t5']))).toEqual([groups[0].subGroups[0].groupId]);
        expect(groupsHidingTrips(groups, new Set(['t0']))).toEqual([]);
    });
});

describe('isMetroClosed', () => {
    // Prague metro closes 0–5 in Prague time, whatever zone the device is set to.
    it('reads the closed hours in the city zone', () => {
        const at = Date.parse('2026-10-07T00:30:00+02:00');
        expect(isMetroClosed(at, 'Europe/Prague', [0, 5])).toBe(true);
        expect(isMetroClosed(at, 'Europe/London', [0, 5])).toBe(false);
        expect(isMetroClosed(at, 'Europe/Prague', null)).toBe(false);
    });
});

describe('favoriteLineNames', () => {
    // A disruption matters to a rider on a pinned line or on any line serving a pinned stop.
    it('collects pinned lines and the lines of pinned stops', () => {
        const stop = (lines: string[]) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [14.42, 50.08] as [number, number] },
            properties: { stop_id: 's', stop_name: 's', location_type: 0, lines: lines.map(name => ({ name, type: 'tram' as const, route_color: '#000' })) },
        });
        const names = favoriteLineNames([{ city: 'prague', stopId: 'x', line: '17', headsign: 'Libuš' }], [stop(['9', '22']), stop(['22'])]);
        expect([...names].sort()).toEqual(['17', '22', '9']);
    });
});

