import { describe, expect, it } from 'vitest';
import { stopModel } from '@/test/factories';
import { badgeLines, hidesNightLinesAt, favoriteMarks, nightLinesByNetwork, networksHidingNightLines, platformIdByCode, sectionStopId, stopBadgeTiles, stopModeList, toMapStops } from './stations';

describe('stopModeList', () => {
    it('orders a stop\'s modes as ROUTE_TYPE_ORDER, each once', () => {
        expect(stopModeList({
            lines: [
                { name: '9', type: 'bus', route_color: '' },
                { name: '25', type: 'trolleybus', route_color: '' },
                { name: '1', type: 'tram', route_color: '' },
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
    const model = stopModel([
        { id: 'S', platforms: [{ id: 'P1' }, { id: 'P2' }] },
        { id: 'Q', platforms: [{ id: 'Q1', aliases: ['Q1P'] }] },
    ]);

    // Below the platforms' zoom only the station is drawn, so a pinned platform must star its station.
    it('stars the station of a pinned platform, and only that platform', () => {
        expect(favoriteMarks([{ model, pinIds: ['P2'] }])).toEqual({ stationIds: ['S'], platformIds: ['P2'] });
    });

    it('stars every platform of a pinned station', () => {
        expect(favoriteMarks([{ model, pinIds: ['S'] }])).toEqual({ stationIds: ['S'], platformIds: ['P1', 'P2'] });
    });

    // A pin saved under an alias or a pre-stops.json PID id still stars its stop.
    it('stars a stop pinned under an alias or a comma-joined id', () => {
        expect(favoriteMarks([{ model, pinIds: ['Q1P'] }])).toEqual({ stationIds: ['Q'], platformIds: ['Q1'] });
        expect(favoriteMarks([{ model: null, pinIds: ['P1,P2'] }, { model, pinIds: ['P1,P2'] }])).toEqual({ stationIds: ['S'], platformIds: ['P1', 'P2'] });
    });
});

describe('toMapStops', () => {
    const model = stopModel([{ id: 'S', platforms: [{ id: 'P1', code: 'A', routes: ['MB', 'T9'] }, { id: 'P2' }] }],
        [{ id: 'E1', station: 'S', name: 'Vstup', pos: [14.42, 50.08] }]);

    // The map reads a stop's badge, rank and id; a platform's code sits beside its mode tiles.
    it('draws each stop with its badge tiles and leading mode', () => {
        const [station, coded] = toMapStops([...model.stations, ...model.platforms]).features.map(f => f.properties);
        expect(station).toMatchObject({ stop_id: 'S', kind: 'station', badges: 'metro/B/F8B322|tram', mode_rank: 0 });
        expect(coded).toMatchObject({ stop_id: 'P1', kind: 'platform', badges: 'metro/B/F8B322|tram', platform_code: 'A' });
    });

    // A train platform only the live feed serves still needs a badge to be tapped.
    it('gives a platform without lines a tile, and an entrance none', () => {
        const [plain, entrance] = toMapStops([model.platforms[1]!, ...model.entrances]).features.map(f => f.properties);
        expect(plain!.badges).toBe('unknown');
        expect(entrance).toEqual({ stop_id: 'E1', stop_name: 'Vstup', kind: 'entrance' });
    });
});

describe('badgeLines', () => {
    const tram = { name: '4', type: 'tram' as const, route_color: '' };
    const nightBus = { name: 'N89', type: 'bus' as const, route_color: '', night: true as const };

    // A night bus at a tram stop must not show a bus on its badge by day.
    it('leaves night lines out while they are hidden', () => {
        expect(badgeLines({ lines: [tram, nightBus] }, true).lines).toEqual([tram]);
    });

    // A stop served only at night stays on the map with its own badge.
    it('keeps the night lines of a stop that has no other', () => {
        expect(badgeLines({ lines: [nightBus] }, true).lines).toEqual([nightBus]);
    });

    it('shows every line at night', () => {
        expect(badgeLines({ lines: [tram, nightBus] }, false).lines).toEqual([tram, nightBus]);
    });
});

describe('sectionStopId', () => {
    const { platforms } = stopModel([{ id: 'S', platforms: [
        { id: 'P1', code: 'A' },
        { id: 'P2', direction: 'Grohova' },
        { id: 'P3', direction: 'Grohova' },
        { id: 'M1', code: '1', routes: ['MB'] },
    ] }]);
    const section = (platform: string | null, direction: string | null, platformStopIds: string[] = []) =>
        ({ platform, direction, groups: [{ subGroups: [{ departures: platformStopIds.map(platformStopId => ({ platformStopId })) }] }] });

    // A section header opens a board of every platform the section shows, so it lists the same departures.
    it('opens every platform of a code or a direction as one stop', () => {
        expect(sectionStopId(platforms, section('A', null), 'S')).toBe('P1');
        expect(sectionStopId(platforms, section(null, 'Grohova'), 'S')).toBe('P2,P3');
    });

    it('opens nothing for a metro section or the board already open', () => {
        expect(sectionStopId(platforms, section(null, null), 'S')).toBeNull();
        expect(sectionStopId(platforms, section(null, 'Grohova'), 'P2,P3')).toBeNull();
    });

    it('falls back to the departures\' own platforms the stop list does not know', () => {
        expect(sectionStopId(platforms, section('Z', null, ['X1', 'X1']), 'S')).toBe('X1');
    });
});

describe('hidesNightLinesAt', () => {
    // By day a stop's badge leaves out night lines; at night it shows them all.
    it('hides night lines only outside the night hours', () => {
        expect(hidesNightLinesAt(Date.parse('2026-10-16T10:00:00Z'), 'Europe/Prague', [22, 5])).toBe(true);
        expect(hidesNightLinesAt(Date.parse('2026-10-16T22:30:00Z'), 'Europe/Prague', [22, 5])).toBe(false);
    });
});

describe('nightLinesByNetwork', () => {
    const networks = {
        brno: { timeZone: 'Europe/Prague', nightHours: [22, 5] as [number, number] },
        prague: { timeZone: 'Europe/Prague', nightHours: [0, 5] as [number, number] },
    };

    // A neighbouring network's stop follows its own city's night hours, not the selected city's.
    it('reads each stop\'s night hours from its own network', () => {
        const at2230 = nightLinesByNetwork(networksHidingNightLines(Date.parse('2026-10-16T20:30:00Z'), networks), 'prague');
        expect(at2230(undefined)).toBe(true);
        expect(at2230('brno')).toBe(false);
        expect(at2230('presov')).toBe(false);
    });

    // The key stays the same while no network's night hours start or end, so the map keeps its badges.
    it('keys on which networks hide night lines, not on the time', () => {
        expect(networksHidingNightLines(Date.parse('2026-10-16T10:00:00Z'), networks)).toBe('brno,prague');
        expect(networksHidingNightLines(Date.parse('2026-10-16T14:00:00Z'), networks)).toBe('brno,prague');
        expect(networksHidingNightLines(Date.parse('2026-10-16T23:30:00Z'), networks)).toBe('');
    });
});

describe('platformIdByCode', () => {
    const { platforms } = stopModel([{ id: 'S', platforms: [
        { id: 'T1', code: '1', routes: ['MA'] },
        { id: 'P1', code: '1' },
        { id: 'PA', aliases: ['PA2'], code: 'A' },
    ] }]);

    // A notice's platform code opens a board only when it names one platform, never a guess between a metro track and a stop.
    it('finds the one platform with a code, and none when the code is shared', () => {
        expect(platformIdByCode(platforms, 'A')).toBe('PA');
        expect(platformIdByCode(platforms, '1')).toBeNull();
        expect(platformIdByCode(platforms.slice(0, 1), '1')).toBe('T1');
        expect(platformIdByCode(platforms, 'Z')).toBeNull();
    });
});
