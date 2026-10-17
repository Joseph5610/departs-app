import type { RouteInfo, StopCollection, StopFeature, StopProperties, StopsFile, StopsFilePlatform } from '@/types';
import { normalizeRouteType } from '@/domain/routes';

type StopLines = NonNullable<StopProperties['lines']>;

const pointAt = (pos: [number, number]) => ({ type: 'Point' as const, coordinates: pos });

/** A platform's ids: its own first, then its aliases. */
const idsOf = (p: StopsFilePlatform): string[] => p.aliases ? [p.id, ...p.aliases] : [p.id];

/**
 * A city's `stops.json` as the stop features the map, search and panels read: stations first (marked
 * `is_centroid`, so a platform's own entry wins in `indexStopsById`), then platforms and entrances. A platform
 * keeps its aliases comma-joined in `stop_id`, the id links, favorites and the departures API already use.
 * With `stationsByPlatforms` a station's `stop_id` is its platforms' ids, comma-joined, for a departures API
 * that knows no stations.
 */
export const stopCollectionFromFile = (file: StopsFile, routes: Readonly<Record<string, RouteInfo>>, stationsByPlatforms = false): StopCollection => {
    const linesOf = (ids: readonly string[]): StopLines => ids.flatMap(id => {
        const route = routes[id];
        return route ? [{ name: route.name, type: normalizeRouteType(route.type), route_color: route.route_color }] : [];
    });

    const platformsOf = new Map<string, StopsFilePlatform[]>();
    for (const p of file.platforms) {
        const list = platformsOf.get(p.station);
        if (list) list.push(p);
        else platformsOf.set(p.station, [p]);
    }
    const nameOf = new Map(file.stations.map(s => [s.id, s.name]));
    const stationIds = new Map(stationsByPlatforms ? file.stations.map(s => [s.id, (platformsOf.get(s.id) ?? []).flatMap(idsOf).join(',') || s.id]) : []);

    const stations = file.stations.map((s): StopFeature => {
        const platforms = platformsOf.get(s.id) ?? [];
        const lines = new Map<string, StopLines[number]>();
        for (const line of linesOf(platforms.flatMap(p => p.routes))) lines.set(`${line.type}|${line.name}`, line);
        const stopId = stationIds.get(s.id) ?? s.id;
        return {
            type: 'Feature',
            geometry: pointAt(s.pos),
            properties: {
                stop_id: stopId,
                stop_name: s.name,
                location_type: 1,
                is_centroid: true,
                zone_id: platforms[0]?.zones?.[0],
                lines: [...lines.values()],
                // The station's own id stays resolvable where `stop_id` lists its platforms instead.
                all_ids: stopId === s.id ? platforms.flatMap(idsOf) : [s.id, ...platforms.flatMap(idsOf)],
                platform_count: platforms.length,
                // Nobody boards at a station whose every platform is alight-only: the map leaves it out with them.
                is_drop_off_only: platforms.every(p => p.alightOnly) ? true : undefined,
            },
        };
    });

    const platforms = file.platforms.map((p): StopFeature => ({
        type: 'Feature',
        geometry: pointAt(p.pos),
        properties: {
            stop_id: idsOf(p).join(','),
            stop_name: nameOf.get(p.station) ?? '',
            platform_code: p.code,
            direction: p.direction,
            location_type: 0,
            zone_id: p.zones?.[0],
            is_centroid: false,
            is_drop_off_only: p.alightOnly,
            lines: linesOf(p.routes),
            all_ids: p.aliases ? idsOf(p) : undefined,
            interchanges: p.interchanges,
        },
    }));

    const entrances = file.entrances.map((e): StopFeature => ({
        type: 'Feature',
        geometry: pointAt(e.pos),
        properties: { stop_id: e.id, stop_name: e.name, location_type: 2 },
    }));

    return { type: 'FeatureCollection', features: [...stations, ...platforms, ...entrances] };
};

