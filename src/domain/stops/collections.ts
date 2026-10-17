import type { PinnedStop, SelectedStop, StopCollection, StopFeature, StopProperties, SearchHistoryBase } from '@/types';
import { servesMode, stopIdParts, uniqueLines } from './stations';

/** The platforms (and entrances) and the stations of a stop list, as the map's two stop sources take them; alight-only ones are left out. */
export const splitStopCollection = (collection: StopCollection | undefined) => {
    if (!collection) return { platforms: null, stations: null };
    const platforms: StopFeature[] = [];
    const stations: StopFeature[] = [];
    for (const f of collection.features) {
        if (f.properties.is_drop_off_only) continue;
        (f.properties.is_station ? stations : platforms).push(f);
    }
    return {
        platforms: { type: 'FeatureCollection', features: platforms } as StopCollection,
        stations: { type: 'FeatureCollection', features: stations } as StopCollection,
    };
};

/** Whether a stop passes the map's stop-type filter; an empty filter passes every stop. */
export const matchesStopTypeFilter = (props: StopProperties | null, stopTypeFilter: readonly string[]): boolean => {
    if (!props || stopTypeFilter.length === 0) return true;
    return (stopTypeFilter.includes('metro') && servesMode(props, 'metro')) || (stopTypeFilter.includes('train') && servesMode(props, 'train'));
};

/** The stops for `ids` that the stop list knows, in the order given. */
export const stopsByIds = (stopIndex: ReadonlyMap<string, StopFeature>, ids: readonly string[]): StopFeature[] =>
    ids.map(id => stopIndex.get(id)).filter((s): s is StopFeature => s !== undefined);

/**
 * The pinned stops the stop list knows, in pin order, each kept with its pinned ids so unpinning and
 * reordering write those ids back; a stop pinned under several ids is listed once, at its first pin.
 */
export const pinnedStops = (stopIndex: ReadonlyMap<string, StopFeature>, ids: readonly string[]): PinnedStop[] => {
    const byFeature = new Map<StopFeature, PinnedStop>();
    for (const id of ids) {
        const feature = stopIndex.get(id);
        if (!feature) continue;
        const pin = byFeature.get(feature);
        if (pin) pin.ids.push(id);
        else byFeature.set(feature, { id, ids: [id], feature });
    }
    return [...byFeature.values()];
};

/** The colour of `line` as the stop list records it for this stop, or undefined when the stop does not list it. */
export const lineColorAt = (stop: StopFeature | undefined, line: string): string | undefined =>
    stop?.properties.lines?.find(l => l.name === line)?.route_color;

const stopSummary = (feature: StopFeature) => {
    const { stop_id, stop_name, platform_code, lines } = feature.properties;
    return {
        stop_id,
        stop_name,
        platform_code,
        lines,
        coordinates: feature.geometry.coordinates as [number, number],
    };
};

/** The panel's view of a stop from its map feature. */
export const toSelectedStop = (feature: StopFeature): SelectedStop => ({ ...stopSummary(feature), all_ids: feature.properties.all_ids, is_station: feature.properties.is_station, platform_count: feature.properties.platform_count });

/**
 * The stop a board shows for `stopId`: its own entry, or for a comma-joined id of several platforms (a board
 * section's) one stop named after the first, with all their ids and lines; just the id when none is known.
 */
export const selectedStopOf = (stopId: string, stopIndex: ReadonlyMap<string, StopFeature>): SelectedStop => {
    const own = stopIndex.get(stopId);
    if (own) return toSelectedStop(own);
    const features = [...new Set(stopIdParts(stopId).map(id => stopIndex.get(id)).filter((f): f is StopFeature => !!f))];
    const first = features[0];
    if (!first) return { stop_id: stopId };
    return {
        ...toSelectedStop(first),
        stop_id: stopId,
        lines: uniqueLines(features.flatMap(f => f.properties.lines ?? [])),
        all_ids: features.flatMap(f => stopIdParts(f.properties.stop_id)),
        is_station: false,
        platform_count: features.length,
    };
};

/** A search history entry for a stop picked in `city`. */
export const stopHistoryEntry = (feature: StopFeature, city: string): SearchHistoryBase => ({ type: 'stop', city_slug: city, ...stopSummary(feature) });

/** Every stop id and each of its `all_ids` to its feature; a platform's own entry wins over its station's. */
export const indexStopsById = (collection: StopCollection | undefined): Map<string, StopFeature> => {
    const idx = new Map<string, StopFeature>();
    for (const f of collection?.features ?? []) {
        idx.set(f.properties.stop_id, f);
        for (const subId of f.properties.all_ids ?? []) {
            idx.set(subId, f);
        }
    }
    return idx;
};
