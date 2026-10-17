import { describe, expect, it } from 'vitest';
import type { StopCollection, StopFeature } from '@/types';
import { badgeLines, hiddenNightLinesAt, favoriteMarks, isStationBoard, nightLinesByNetwork, networksHidingNightLines, platformIdByCode, sectionStopId, stopBadgeTiles, stopModeList } from './stations';

const stop = (stop_id: string, properties: Partial<StopFeature['properties']> = {}, coordinates: [number, number] = [14.42, 50.08]): StopFeature => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates },
    properties: { stop_id, stop_name: 'Anděl', location_type: 0, ...properties },
});

const collection = (...features: StopFeature[]): StopCollection => ({ type: 'FeatureCollection', features });

describe('stopModeList', () => {
    // Networks write a line's mode as a name (PID) or a GTFS code (IDS JMK, DPMP); both must give one badge order.
    it('normalizes named and GTFS-coded modes into ROUTE_TYPE_ORDER without duplicates', () => {
        expect(stopModeList({
            lines: [
                { name: '9', type: '3' as never, route_color: '' },
                { name: '25', type: 'trolleybus', route_color: '' },
                { name: '1', type: '0' as never, route_color: '' },
                { name: '2', type: 'tram', route_color: '' },
                { name: 'B', type: 'metro', route_color: '#F8B322' },
            ],
        })).toEqual(['metro', 'tram', 'trolleybus', 'bus']);
    });
});

describe('stopBadgeTiles', () => {
    // A transfer station shows each metro line in its own colour, as on PID signage.
    it('splits metro into one tile per line, in line order, ahead of the other modes', () => {
        expect(stopBadgeTiles({
            lines: [
                { name: '9', type: 'tram', route_color: '' },
                { name: 'C', type: 'metro', route_color: '#CF003D' },
                { name: 'A', type: 'metro', route_color: '#00A562' },
            ],
        })).toBe('metro/A/00A562|metro/C/CF003D|tram');
    });
});

describe('favoriteMarks', () => {
    const platforms = collection(stop('P1'), stop('P2'), stop('Q1,Q1P'));
    const stations = collection(
        stop('S', { all_ids: ['P1', 'P2'] }),
        stop('Q1,Q1P'),
    );

    // Below the platforms' zoom only the station is drawn, so a pinned platform must star its station.
    it('stars the station of a pinned platform, and only that platform', () => {
        expect(favoriteMarks(stations, platforms, ['P2'])).toEqual({ stationIds: ['S'], platformIds: ['P2'] });
    });

    it('stars every platform of a pinned station', () => {
        expect(favoriteMarks(stations, platforms, ['S'])).toEqual({ stationIds: ['S'], platformIds: ['P1', 'P2'] });
    });

    // A PID station id and a merged platform id are comma-joined; one part pinned is enough.
    it('matches comma-joined ids part by part', () => {
        expect(favoriteMarks(stations, platforms, ['Q1P'])).toEqual({ stationIds: ['Q1,Q1P'], platformIds: ['Q1,Q1P'] });
    });
});

describe('isStationBoard', () => {
    // PID lists a platform once per fare zone; the app shows the pair as the one platform it is.
    it('treats a station of one platform, listed once per fare zone, as that platform', () => {
        expect(isStationBoard({ is_centroid: true, platform_count: 1 })).toBe(false);
    });

    it('treats a station of several platforms as a station', () => {
        expect(isStationBoard({ is_centroid: true, platform_count: 2 })).toBe(true);
    });

    it('treats a platform as a platform', () => {
        expect(isStationBoard({ platform_count: 2 })).toBe(false);
    });
});

describe('badgeLines', () => {
    const isNight = (_type: string, name: string) => /^N/.test(name);
    const tram = { name: '4', type: 'tram' as const, route_color: '' };
    const nightBus = { name: 'N89', type: 'bus' as const, route_color: '' };

    // A night bus at a tram stop must not show a bus on its badge by day.
    it('leaves night lines out while they are hidden', () => {
        expect(badgeLines({ lines: [tram, nightBus] }, isNight).lines).toEqual([tram]);
    });

    // A stop served only at night stays on the map with its own badge.
    it('keeps the night lines of a stop that has no other', () => {
        expect(badgeLines({ lines: [nightBus] }, isNight).lines).toEqual([nightBus]);
    });

    it('shows every line at night', () => {
        expect(badgeLines({ lines: [tram, nightBus] }, null).lines).toEqual([tram, nightBus]);
    });
});

describe('sectionStopId', () => {
    const index = new Map([
        ['S', stop('S', { is_centroid: true })],
        ['P1', stop('P1', { platform_code: 'A' })],
        ['P2', stop('P2', { direction: 'Grohova' })],
        ['P3', stop('P3', { direction: 'Grohova' })],
        ['M1', stop('M1', { platform_code: '1', lines: [{ name: 'B', type: 'metro', route_color: '#F8B322' }] })],
    ]);
    const section = (platform: string | null, direction: string | null, platformStopIds: string[] = []) =>
        ({ platform, direction, groups: [{ subGroups: [{ departures: platformStopIds.map(platformStopId => ({ platformStopId })) }] }] });
    const ids = ['S', 'P1', 'P2', 'P3', 'M1'];

    // A section header opens a board of every platform the section shows, so it lists the same departures.
    it('opens every platform of a code or a direction as one stop', () => {
        expect(sectionStopId(ids, index, section('A', null), 'S')).toBe('P1');
        expect(sectionStopId(ids, index, section(null, 'Grohova'), 'S')).toBe('P2,P3');
    });

    it('opens nothing for a metro section or the board already open', () => {
        expect(sectionStopId(ids, index, section(null, null), 'S')).toBeNull();
        expect(sectionStopId(ids, index, section(null, 'Grohova'), 'P2,P3')).toBeNull();
    });

    it('falls back to the departures\' own platforms the stop list does not know', () => {
        expect(sectionStopId(ids, index, section('Z', null, ['X1', 'X1']), 'S')).toBe('X1');
    });
});

describe('hiddenNightLinesAt', () => {
    const isNight = () => true;
    const rules = { isNightLine: isNight, nightHours: [22, 5] as [number, number] };

    // By day a stop's badge leaves out night lines; at night it shows them all.
    it('hides night lines only outside the night hours', () => {
        expect(hiddenNightLinesAt(Date.parse('2026-10-16T10:00:00Z'), 'Europe/Prague', rules)).toBe(isNight);
        expect(hiddenNightLinesAt(Date.parse('2026-10-16T22:30:00Z'), 'Europe/Prague', rules)).toBeNull();
    });

    it('hides nothing in a city that tells no night lines', () => {
        expect(hiddenNightLinesAt(Date.parse('2026-10-16T10:00:00Z'), 'Europe/Prague', { ...rules, isNightLine: null })).toBeNull();
    });
});

describe('nightLinesByNetwork', () => {
    const brnoNight = () => true;
    const networks = {
        brno: { timeZone: 'Europe/Prague', rules: { isNightLine: brnoNight, nightHours: [22, 5] as [number, number] } },
        prague: { timeZone: 'Europe/Prague', rules: { isNightLine: null, nightHours: [22, 5] as [number, number] } },
    };

    // A neighbouring network's stop follows its own city's night lines, not the selected city's.
    it('reads each stop\'s rules from its own network', () => {
        const byDay = nightLinesByNetwork(networksHidingNightLines(Date.parse('2026-10-16T10:00:00Z'), networks), 'prague', networks);
        expect(byDay({})).toBeNull();
        expect(byDay({ city_slug: 'brno' })).toBe(brnoNight);
        expect(byDay({ city_slug: 'presov' })).toBeNull();
    });

    // The key stays the same while no network's night hours start or end, so the map keeps its badges.
    it('keys on which networks hide night lines, not on the time', () => {
        expect(networksHidingNightLines(Date.parse('2026-10-16T10:00:00Z'), networks)).toBe('brno');
        expect(networksHidingNightLines(Date.parse('2026-10-16T14:00:00Z'), networks)).toBe('brno');
        expect(networksHidingNightLines(Date.parse('2026-10-16T22:30:00Z'), networks)).toBe('');
    });

    it('hides nothing at night', () => {
        expect(nightLinesByNetwork(networksHidingNightLines(Date.parse('2026-10-16T22:30:00Z'), networks), 'brno', networks)({})).toBeNull();
    });
});

describe('platformIdByCode', () => {
    const index = new Map([
        ['S', stop('S', { is_centroid: true })],
        ['T1', stop('T1', { platform_code: '1', lines: [{ name: 'A', type: 'metro', route_color: '#00A562' }] })],
        ['P1', stop('P1', { platform_code: '1' })],
        ['PA', stop('PA', { platform_code: 'A' })],
        ['PA2', stop('PA', { platform_code: 'A' })],
    ]);

    // A notice's platform code opens a board only when it names one platform, never a guess between a metro track and a stop.
    it('finds the one platform with a code, aliases included, and none when the code is shared', () => {
        expect(platformIdByCode(['S', 'PA', 'PA2'], index, 'A')).toBe('PA');
        expect(platformIdByCode(['S', 'T1', 'P1'], index, '1')).toBeNull();
        expect(platformIdByCode(['S', 'T1'], index, '1')).toBe('T1');
        expect(platformIdByCode(['S', 'PA'], index, 'Z')).toBeNull();
    });
});
