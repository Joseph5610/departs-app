import type { RouteType, StopCollection, StopFeature, StopProperties } from '@/types';
import { normalizeRouteType, routeTypeRank } from '@/domain/routes';
import type { LineRules } from '@/config/cities';
import { isWithinLocalHours } from '@/domain/time';

/** Whether a stop's board gathers several platforms, so its rows name the platform each leaves from. */
export const isStationBoard = (stop: Pick<StopProperties, 'platform_count' | 'is_station'>): boolean =>
    !!stop.is_station && (stop.platform_count ?? 0) > 1;

/** Separator of the tiles in a stop's `badges` property, which the map's badge images are named after. */
export const STOP_BADGE_SEPARATOR = '|';
/** Separator inside a tile: a metro line and its colour without `#` (`metro/B/F8B322`), a platform's code (`code/A`). */
export const TILE_PART_SEPARATOR = '/';
/** The badge part naming a platform's code (`code/A`), drawn as a circle beside its mode tiles. */
export const PLATFORM_CODE_TILE = 'code';

/** Whether any of a stop's lines is of `mode`. */
export const servesMode = (props: Pick<StopProperties, 'lines'>, mode: RouteType): boolean =>
    (props.lines ?? []).some(line => normalizeRouteType(line.type) === mode);

/** The modes serving a stop in ROUTE_TYPE_ORDER (metro before train before tram...), without `unknown`. */
export const stopModeList = (props: Pick<StopProperties, 'lines'>): RouteType[] => {
    const modes = new Set<RouteType>();
    for (const line of props.lines ?? []) {
        const mode = normalizeRouteType(line.type);
        if (mode !== 'unknown') modes.add(mode);
    }
    return [...modes].sort((a, b) => routeTypeRank(a) - routeTypeRank(b));
};

/**
 * The tiles of a stop's map badge: one per mode in display order, metro as one tile per line
 * (`metro/B/F8B322|tram|bus`); empty when the stop lists no lines.
 */
export const stopBadgeTiles = (props: Pick<StopProperties, 'lines'>, modes = stopModeList(props)): string => {
    const tiles: string[] = [];
    for (const mode of modes) {
        if (mode !== 'metro') { tiles.push(mode); continue; }
        const metro = (props.lines ?? []).filter(line => normalizeRouteType(line.type) === 'metro').sort((a, b) => a.name.localeCompare(b.name));
        if (metro.length === 0) tiles.push(mode);
        for (const line of metro) tiles.push([mode, line.name, line.route_color.replace('#', '')].join(TILE_PART_SEPARATOR));
    }
    return tiles.join(STOP_BADGE_SEPARATOR);
};

/** Tells a night line by its mode and name (the city's `isNightLine`). */
export type NightLineTest = NonNullable<LineRules['isNightLine']>;

/** The night lines stop badges leave out at `nowMs`: the city's night lines outside its night hours, else none. */
export const hiddenNightLinesAt = (nowMs: number, timeZone: string, rules: Pick<LineRules, 'isNightLine' | 'nightHours'>): NightLineTest | null =>
    rules.isNightLine && !isWithinLocalHours(nowMs, timeZone, rules.nightHours) ? rules.isNightLine : null;

/** The lines a stop's badge shows: without night lines when `hiddenNightLines` is given, unless the stop has no other. */
export const badgeLines = (props: Pick<StopProperties, 'lines'>, hiddenNightLines: NightLineTest | null): Pick<StopProperties, 'lines'> => {
    if (!hiddenNightLines || !props.lines) return props;
    const day = props.lines.filter(line => !hiddenNightLines(line.type, line.name));
    return day.length ? { lines: day } : props;
};

/** The night lines a stop's badge leaves out, from the stop itself (its network); null for none. */
export type HiddenNightLinesOf = (props: Pick<StopProperties, 'city_slug'>) => NightLineTest | null;

/** A network's clock and line conventions, as `hiddenNightLinesAt` reads them. */
export interface NightLineNetwork {
    timeZone: string;
    rules: Pick<LineRules, 'isNightLine' | 'nightHours'>;
}

/** The networks whose stop badges leave night lines out at `nowMs`, as a key that changes only when that set does. */
export const networksHidingNightLines = (nowMs: number, networks: Readonly<Record<string, NightLineNetwork>>): string =>
    Object.entries(networks).filter(([, n]) => hiddenNightLinesAt(nowMs, n.timeZone, n.rules)).map(([slug]) => slug).join(',');

/**
 * The night lines each stop's badge leaves out, given the networks hiding them (`networksHidingNightLines`): a
 * neighbouring network's stop (`city_slug`) follows its own city's rules, any other stop `ownCity`'s.
 */
export const nightLinesByNetwork = (hiding: string, ownCity: string, networks: Readonly<Record<string, NightLineNetwork>>): HiddenNightLinesOf => {
    const hidden = new Set(hiding.split(','));
    return (props) => {
        const slug = props.city_slug ?? ownCity;
        return hidden.has(slug) ? networks[slug]?.rules.isNightLine ?? null : null;
    };
};

const withModes = (f: StopFeature, hiddenNightLines: NightLineTest | null): StopFeature => {
    const shown = badgeLines(f.properties, hiddenNightLines);
    const modes = stopModeList(shown);
    const code = f.properties.is_station ? undefined : f.properties.platform_code;
    // A platform without lines (a train platform the live feed alone serves) still gets a tile, so it can be tapped.
    const tiles = stopBadgeTiles(shown, modes) || (f.properties.is_station ? '' : 'unknown');
    const badges = code ? [tiles, [PLATFORM_CODE_TILE, code].join(TILE_PART_SEPARATOR)].join(STOP_BADGE_SEPARATOR) : tiles;
    return { ...f, properties: { ...f.properties, badges, mode_rank: routeTypeRank(modes[0]) } };
};

/** Each stop carrying its `badges` tiles and the rank of its leading mode, without the night lines `hiddenNightLinesOf` names for it. */
export const withStopModes = (collection: StopCollection | null, hiddenNightLinesOf: HiddenNightLinesOf = () => null): StopCollection | null =>
    collection && { ...collection, features: collection.features.map(f => withModes(f, hiddenNightLinesOf(f.properties))) };

/** Each of `ids` the stop list knows a platform code for, mapped to that code. */
export const platformCodes = (ids: readonly string[], stopIndex: ReadonlyMap<string, StopFeature>): Map<string, string> => {
    const codes = new Map<string, string>();
    for (const id of ids) {
        const code = stopIndex.get(id)?.properties.platform_code;
        if (code) codes.set(id, code);
    }
    return codes;
};

/** A board section as `sectionStopId` reads it: its platform code or direction, and its departures' platforms. */
export interface SectionPlatforms {
    platform: string | null;
    direction: string | null;
    groups: readonly { subGroups: readonly { departures: readonly { platformStopId?: string }[] }[] }[];
}

/** The platforms among a station's `all_ids`, each once though its aliases name it again. */
const stationPlatforms = (stationIds: readonly string[], stopIndex: ReadonlyMap<string, StopFeature>): StopProperties[] => {
    const found = new Map<string, StopProperties>();
    for (const id of stationIds) {
        const p = stopIndex.get(id)?.properties;
        if (p && !p.is_station) found.set(p.stop_id, p);
    }
    return [...found.values()];
};

const isMetroOnly = (p: StopProperties) => !!p.lines?.length && p.lines.every(line => line.type === 'metro');

/**
 * The stop a board section's header opens: every platform of the station the section stands for (by its code,
 * or without one by the direction it serves), comma-joined as one stop; the departures' own platforms where the
 * stop list knows none. Null for a metro section (each line numbers its own tracks) or the board already open.
 */
export const sectionStopId = (
    stationIds: readonly string[],
    stopIndex: ReadonlyMap<string, StopFeature>,
    { platform, direction, groups }: SectionPlatforms,
    openStopId: string,
): string | null => {
    const found = new Set(stationPlatforms(stationIds, stopIndex)
        .filter(p => !isMetroOnly(p) && (platform ? p.platform_code === platform : !!direction && !p.platform_code && p.direction === direction))
        .map(p => p.stop_id));
    if (found.size === 0) {
        for (const group of groups) for (const sub of group.subGroups) for (const dep of sub.departures) if (dep.platformStopId) found.add(dep.platformStopId);
    }
    const stopId = [...found].join(',');
    return stopId && stopId !== openStopId ? stopId : null;
};

/**
 * The `stop_id` of the one platform of a station with `code`, for a notice naming it; null when none has it or
 * several do (a metro track and a tram platform both `1`), so the notice links nowhere rather than to a guess.
 */
export const platformIdByCode = (stationIds: readonly string[], stopIndex: ReadonlyMap<string, StopFeature>, code: string): string | null => {
    const found = stationPlatforms(stationIds, stopIndex).filter(p => p.platform_code === code);
    return found.length === 1 ? found[0]!.stop_id : null;
};

/** The ids a stop id names: a single stop, or a comma-joined list (a PID station, a merged platform, a board section). */
export const stopIdParts = (id: string): string[] => id.split(',');

/** Lines without repeats of the same mode and name, as a station lists its platforms' lines. */
export const uniqueLines = <L extends { type: string; name: string }>(lines: readonly L[]): L[] =>
    [...new Map(lines.map(line => [`${line.type}|${line.name}`, line])).values()];

export interface FavoriteMarks {
    stationIds: string[];
    platformIds: string[];
}

const NO_MARKS: FavoriteMarks = { stationIds: [], platformIds: [] };

/**
 * The stations and platforms the map stars for the pinned `favoriteIds`: a station when it or any of
 * its platforms is pinned, a platform when it or its whole station is pinned. Ids may be comma-joined
 * (a PID station or a merged platform), so they are compared part by part.
 */
export const favoriteMarks = (stations: StopCollection | null, platforms: StopCollection | null, favoriteIds: readonly string[]): FavoriteMarks => {
    if (favoriteIds.length === 0) return NO_MARKS;
    const pinned = new Set(favoriteIds.flatMap(stopIdParts));
    const whole = new Set(favoriteIds);
    const stationIds: string[] = [];
    for (const { properties: p } of stations?.features ?? []) {
        const parts = p.all_ids ?? stopIdParts(p.stop_id);
        if (whole.has(p.stop_id)) {
            stationIds.push(p.stop_id);
            for (const part of parts) pinned.add(part);
        } else if (parts.some(part => pinned.has(part))) {
            stationIds.push(p.stop_id);
        }
    }
    const platformIds = (platforms?.features ?? [])
        .filter(f => stopIdParts(f.properties.stop_id).some(part => pinned.has(part)))
        .map(f => f.properties.stop_id);
    return { stationIds, platformIds };
};
