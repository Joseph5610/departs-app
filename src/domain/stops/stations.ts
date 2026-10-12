import type { RouteType, StopCollection, StopFeature, StopProperties } from '@/types';
import { normalizeRouteType, routeTypeRank } from '@/domain/routes';
import { calculateDistance } from '@/lib/geo';
import { STATIONS } from '@/config/constants';

/** Whether a stop's board gathers several platforms, so its rows name the platform each leaves from. */
export const isStationBoard = (stop: Pick<StopProperties, 'all_ids'>): boolean => (stop.all_ids?.length ?? 0) > 1;

/** Separator of the tiles in a stop's `badges` property, which the map's badge images are named after. */
export const STOP_BADGE_SEPARATOR = '|';
/** Separator inside a metro tile (`metro/B/F8B322`): the line and its colour without `#`. */
export const METRO_TILE_SEPARATOR = '/';

type StopLine = NonNullable<StopProperties['lines']>[number];
type MetroLine = NonNullable<StopProperties['metro_lines']>[number];

/** The modes serving a stop in ROUTE_TYPE_ORDER (metro before train before tram...), without `unknown`. */
export const stopModeList = (props: Pick<StopProperties, 'lines' | 'metro_lines' | 'is_train'>): RouteType[] => {
    const modes = new Set<RouteType>();
    if (props.metro_lines?.length) modes.add('metro');
    if (Number(props.is_train) === 1) modes.add('train');
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
export const stopBadgeTiles = (props: Pick<StopProperties, 'lines' | 'metro_lines' | 'is_train'>, modes = stopModeList(props)): string => {
    const tiles: string[] = [];
    for (const mode of modes) {
        if (mode !== 'metro') { tiles.push(mode); continue; }
        const metro = [...(props.metro_lines ?? [])].sort((a, b) => a.name.localeCompare(b.name));
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

/** Splits same-named platforms into the groups standing within `radiusM` of each other (single linkage). */
const nearbyGroups = (members: StopFeature[], radiusM: number): StopFeature[][] => {
    if (members.length === 1) return [members];
    const groupOf = members.map((_, i) => i);
    const root = (i: number): number => (groupOf[i] === i ? i : (groupOf[i] = root(groupOf[i])));
    for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
            if (root(i) === root(j)) continue;
            const a = members[i].geometry.coordinates as [number, number];
            const b = members[j].geometry.coordinates as [number, number];
            if (calculateDistance(a, b) <= radiusM) groupOf[root(j)] = root(i);
        }
    }
    const groups = new Map<number, StopFeature[]>();
    for (let i = 0; i < members.length; i++) {
        const key = root(i);
        const group = groups.get(key);
        if (group) group.push(members[i]);
        else groups.set(key, [members[i]]);
    }
    return [...groups.values()];
};

const toStation = (members: StopFeature[], parentId: string | undefined): StopFeature => {
    const first = members[0].properties;
    const lines = new Map<string, StopLine>();
    const metroLines = new Map<string, MetroLine>();
    const allIds: string[] = [];
    let lng = 0;
    let lat = 0;
    let isTrain = 0;
    for (const { properties: p, geometry } of members) {
        lng += geometry.coordinates[0];
        lat += geometry.coordinates[1];
        allIds.push(...p.stop_id.split(','));
        if (Number(p.is_train) === 1) isTrain = 1;
        for (const line of p.lines ?? []) lines.set(`${normalizeRouteType(line.type)}|${line.name}`, line);
        for (const line of p.metro_lines ?? []) metroLines.set(line.name, line);
    }
    const props: StopProperties = {
        stop_id: parentId ?? members.map(m => m.properties.stop_id).join(','),
        stop_name: first.stop_name,
        location_type: 1,
        zone_id: first.zone_id,
        city_slug: first.city_slug,
        stop_color: first.stop_color,
        is_train: isTrain,
        metro_lines: [...metroLines.values()],
        lines: [...lines.values()],
        all_ids: allIds,
    };
    return withModes({ type: 'Feature', geometry: { type: 'Point', coordinates: [lng / members.length, lat / members.length] }, properties: props });
};

/**
 * The stations a rider sees on the map: platforms of one parent station, or, in a network without
 * parents (PID), same-named platforms within `STATIONS.GROUP_RADIUS_M` of each other. A station's id
 * is its parent's, or its platforms' ids joined by commas, which the departures API reads as one board.
 */
export const groupStations = (platforms: StopCollection | null): StopCollection | null => {
    if (!platforms) return null;
    const groups = new Map<string, StopFeature[]>();
    for (const f of platforms.features) {
        const p = f.properties;
        if (Number(p.location_type) === 2) continue;
        const key = `${p.city_slug ?? ''}|${p.parent_station ? `parent:${p.parent_station}` : `name:${p.stop_name}`}`;
        const group = groups.get(key);
        if (group) group.push(f);
        else groups.set(key, [f]);
    }
    const features: StopFeature[] = [];
    for (const members of groups.values()) {
        const parentId = members[0].properties.parent_station ?? undefined;
        if (parentId) {
            features.push(toStation(members, parentId));
            continue;
        }
        for (const group of nearbyGroups(members, STATIONS.GROUP_RADIUS_M)) {
            features.push(group.length === 1 ? withModes(group[0]) : toStation(group, undefined));
        }
    }
    return { type: 'FeatureCollection', features };
};
