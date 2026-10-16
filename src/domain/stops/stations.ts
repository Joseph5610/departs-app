import type { RouteType, StopCollection, StopFeature, StopProperties } from '@/types';
import { normalizeRouteType, routeTypeRank } from '@/domain/routes';

/** Whether a stop's board gathers several platforms, so its rows name the platform each leaves from. */
export const isStationBoard = (stop: Pick<StopProperties, 'platform_count' | 'is_centroid'>): boolean =>
    !!stop.is_centroid && (stop.platform_count ?? 0) > 1;

/** Separator of the tiles in a stop's `badges` property, which the map's badge images are named after. */
export const STOP_BADGE_SEPARATOR = '|';
/** Separator inside a metro tile (`metro/B/F8B322`): the line and its colour without `#`. */
export const METRO_TILE_SEPARATOR = '/';

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
        for (const line of metro) tiles.push([mode, line.name, line.route_color.replace('#', '')].join(METRO_TILE_SEPARATOR));
    }
    return tiles.join(STOP_BADGE_SEPARATOR);
};

const withModes = (f: StopFeature): StopFeature => {
    const modes = stopModeList(f.properties);
    return { ...f, properties: { ...f.properties, badges: stopBadgeTiles(f.properties, modes), mode_rank: routeTypeRank(modes[0]) } };
};

/** Each stop carrying its `badges` tiles and the rank of its leading mode. */
export const withStopModes = (collection: StopCollection | null): StopCollection | null =>
    collection && { ...collection, features: collection.features.map(withModes) };

/** Each of `ids` the stop list knows a platform code for, mapped to that code. */
export const platformCodes = (ids: readonly string[], stopIndex: ReadonlyMap<string, StopFeature>): Map<string, string> => {
    const codes = new Map<string, string>();
    for (const id of ids) {
        const code = stopIndex.get(id)?.properties.platform_code;
        if (code) codes.set(id, code);
    }
    return codes;
};

const idParts = (id: string): string[] => id.split(',');

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
    const pinned = new Set(favoriteIds.flatMap(idParts));
    const whole = new Set(favoriteIds);
    const stationIds: string[] = [];
    for (const { properties: p } of stations?.features ?? []) {
        const parts = p.all_ids ?? idParts(p.stop_id);
        if (whole.has(p.stop_id)) {
            stationIds.push(p.stop_id);
            for (const part of parts) pinned.add(part);
        } else if (parts.some(part => pinned.has(part))) {
            stationIds.push(p.stop_id);
        }
    }
    const platformIds = (platforms?.features ?? [])
        .filter(f => idParts(f.properties.stop_id).some(part => pinned.has(part)))
        .map(f => f.properties.stop_id);
    return { stationIds, platformIds };
};
