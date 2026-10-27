import type { BoardStop, Entrance, MapStopCollection, MapStopFeature, Platform, RouteType, Stop, StopLine, StopModel } from '@/types';
import { routeTypeRank } from '@/domain/routes';
import { isWithinLocalHours } from '@/domain/time';
import { resolveStop } from './model';

type WithLines = { lines: readonly StopLine[] };

/** Separator of the tiles in a stop's `badges` property, which the map's badge images are named after. */
export const STOP_BADGE_SEPARATOR = '|';
/** Separator inside a tile: a metro line and its colour without `#` (`metro/B/F8B322`). */
export const TILE_PART_SEPARATOR = '/';

/** Whether any of a stop's lines is of `mode`. */
export const servesMode = (props: WithLines, mode: RouteType): boolean =>
    props.lines.some(line => line.type === mode);

/** The modes serving a stop in ROUTE_TYPE_ORDER (metro before train before tram...), without `unknown`. */
export const stopModeList = (props: WithLines): RouteType[] => {
    const modes = new Set<RouteType>();
    for (const line of props.lines) {
        const mode = line.type;
        if (mode !== 'unknown') modes.add(mode);
    }
    return [...modes].sort((a, b) => routeTypeRank(a) - routeTypeRank(b));
};

/**
 * The tiles of a stop's map badge: one per mode in display order, metro as one tile per line
 * (`metro/B/F8B322|tram|bus`); empty when the stop lists no lines.
 */
export const stopBadgeTiles = (props: WithLines, modes = stopModeList(props)): string => {
    const tiles: string[] = [];
    for (const mode of modes) {
        if (mode !== 'metro') { tiles.push(mode); continue; }
        const metro = props.lines.filter(line => line.type === 'metro').sort((a, b) => a.name.localeCompare(b.name));
        if (metro.length === 0) tiles.push(mode);
        for (const line of metro) tiles.push([mode, line.name, line.route_color.replace('#', '')].join(TILE_PART_SEPARATOR));
    }
    return tiles.join(STOP_BADGE_SEPARATOR);
};

/** Whether stop badges leave out night lines at `nowMs`: outside the city's night hours. */
export const hidesNightLinesAt = (nowMs: number, timeZone: string, nightHours: [number, number]): boolean =>
    !isWithinLocalHours(nowMs, timeZone, nightHours);

/** The lines a stop's badge shows: without night lines when `hideNight`, unless the stop has no other. */
export const badgeLines = (props: WithLines, hideNight: boolean): WithLines => {
    if (!hideNight) return props;
    const day = props.lines.filter(line => !line.night);
    return day.length ? { lines: day } : props;
};

/** Whether a stop's badge leaves out night lines, by its network (a neighbouring one's `city`, else the selected). */
export type HiddenNightLinesOf = (city: string | undefined) => boolean;

/** A network's clock and night hours, as `hidesNightLinesAt` reads them. */
export interface NightLineNetwork {
    timeZone: string;
    nightHours: [number, number];
}

/** The networks whose stop badges leave night lines out at `nowMs`, as a key that changes only when that set does. */
export const networksHidingNightLines = (nowMs: number, networks: Readonly<Record<string, NightLineNetwork>>): string =>
    Object.entries(networks).filter(([, n]) => hidesNightLinesAt(nowMs, n.timeZone, n.nightHours)).map(([slug]) => slug).join(',');

/**
 * Whether each stop's badge leaves out night lines, given the networks hiding them (`networksHidingNightLines`): a
 * neighbouring network's stop (`city`) follows its own city's night hours, any other stop `ownCity`'s.
 */
export const nightLinesByNetwork = (hiding: string, ownCity: string): HiddenNightLinesOf => {
    const hidden = new Set(hiding.split(','));
    return (city) => hidden.has(city ?? ownCity);
};

/** A stop as the map draws it: its badge tiles, a platform's code (drawn beside them) and the rank of its leading mode. */
const toMapFeature = (stop: Stop | Entrance, hiddenNightLinesOf: HiddenNightLinesOf): MapStopFeature => {
    const geometry = { type: 'Point' as const, coordinates: stop.pos };
    if (stop.kind === 'entrance') return { type: 'Feature', geometry, properties: { stop_id: stop.id, stop_name: stop.name, kind: 'entrance' } };
    const shown = badgeLines(stop, hiddenNightLinesOf(stop.city));
    const modes = stopModeList(shown);
    const code = stop.kind === 'platform' ? stop.code : undefined;
    // A platform without lines (a train platform the live feed alone serves) still gets a tile, so it can be tapped.
    const tiles = stopBadgeTiles(shown, modes) || (stop.kind === 'platform' ? 'unknown' : '');
    return {
        type: 'Feature',
        geometry,
        properties: { stop_id: stop.id, stop_name: stop.name, kind: stop.kind, badges: tiles, platform_code: code, mode_rank: routeTypeRank(modes[0]), city_slug: stop.city },
    };
};

/** Stops as one map source, each carrying its badge, without night lines where `hiddenNightLinesOf` hides them for its network. */
export const toMapStops = (stops: readonly (Stop | Entrance)[], hiddenNightLinesOf: HiddenNightLinesOf = () => false): MapStopCollection =>
    ({ type: 'FeatureCollection', features: stops.map(stop => toMapFeature(stop, hiddenNightLinesOf)) });

/** A board section as `sectionStopId` reads it: its platform code or direction, and its departures' platforms. */
export interface SectionPlatforms {
    platform: string | null;
    direction: string | null;
    groups: readonly { subGroups: readonly { departures: readonly { platformStopId?: string }[] }[] }[];
}

const isMetroOnly = (p: Platform) => p.lines.length > 0 && p.lines.every(line => line.type === 'metro');

/**
 * The stop a board section's header opens: every platform of the station the section stands for (by its code,
 * or without one by the direction it serves), comma-joined as one stop; the departures' own platforms where the
 * stop list knows none. Null for a metro section (each line numbers its own tracks) or the board already open.
 */
export const sectionStopId = (
    platforms: readonly Platform[],
    { platform, direction, groups }: SectionPlatforms,
    openStopId: string,
): string | null => {
    const found = new Set(platforms
        .filter(p => !isMetroOnly(p) && (platform ? p.code === platform : !!direction && !p.code && p.direction === direction))
        .map(p => p.id));
    if (found.size === 0) {
        for (const group of groups) for (const sub of group.subGroups) for (const dep of sub.departures) if (dep.platformStopId) found.add(dep.platformStopId);
    }
    const stopId = [...found].join(',');
    return stopId && stopId !== openStopId ? stopId : null;
};

/**
 * The id of the one platform of a station with `code`, for a notice naming it; null when none has it or
 * several do (a metro track and a tram platform both `1`), so the notice links nowhere rather than to a guess.
 */
export const platformIdByCode = (platforms: readonly Platform[], code: string): string | null => {
    const found = platforms.filter(p => p.code === code);
    return found.length === 1 ? found[0]!.id : null;
};

export interface FavoriteMarks {
    stationIds: string[];
    platformIds: string[];
}

const NO_MARKS: FavoriteMarks = { stationIds: [], platformIds: [] };

/**
 * The stations and platforms the map stars for each network's own pins, in its stops: a station
 * when it or any of its platforms is pinned, a platform when it, a section holding it or its whole station is.
 */
export const favoriteMarks = (networks: readonly { model: StopModel | null; pinIds: readonly string[] }[]): FavoriteMarks => {
    if (networks.every(n => n.pinIds.length === 0)) return NO_MARKS;
    const stationIds = new Set<string>();
    const platformIds = new Set<string>();
    for (const { model, pinIds } of networks) {
        if (!model) continue;
        for (const id of pinIds) {
            const board: BoardStop | null = resolveStop(model, id);
            if (!board) continue;
            if (board.kind === 'station') stationIds.add(board.id);
            for (const p of board.platforms) {
                platformIds.add(p.id);
                if (board.kind !== 'station') stationIds.add(p.station);
            }
        }
    }
    return { stationIds: [...stationIds], platformIds: [...platformIds] };
};
