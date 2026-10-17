import { describe, expect, it } from 'vitest';
import type { StopCollection, StopFeature } from '@/types';
import { badgeLines, hiddenNightLinesAt, favoriteMarks, isStationBoard, sectionPlatformId, stopBadgeTiles, stopModeList } from './stations';

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

describe('sectionPlatformId', () => {
    const index = new Map([
        ['S', stop('S', { is_centroid: true })],
        ['P1', stop('P1', { platform_code: 'A' })],
        ['P2', stop('P2', { direction: 'Grohova' })],
    ]);

    // A section header opens its platform's own board, found by code or, without one, by direction.
    it('finds the platform a section names by code or by direction', () => {
        expect(sectionPlatformId(['S', 'P1', 'P2'], index, { platform: 'A', direction: null })).toBe('P1');
        expect(sectionPlatformId(['S', 'P1', 'P2'], index, { platform: null, direction: 'Grohova' })).toBe('P2');
        expect(sectionPlatformId(['S', 'P1', 'P2'], index, { platform: 'Z', direction: null })).toBeNull();
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
