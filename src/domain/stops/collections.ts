import type { PinnedStop, SelectedStop, StopCollection, StopFeature, StopProperties, SearchHistoryBase } from '@/types';

/** The platforms and the station centroids of a stop list, as the map's two stop sources take them. */
export const splitStopCollection = (collection: StopCollection | undefined) => {
    if (!collection || !Array.isArray(collection.features)) {
        return { stops: null, centroids: null };
    }

    const features = collection.features;
    const hasCentroids = features.some(f => f.properties.is_centroid);

    const stops: StopCollection = {
        type: 'FeatureCollection',
        features: features.filter(f => !f.properties.is_drop_off_only && (hasCentroids ? !f.properties.is_centroid : true))
    };

    const centroids: StopCollection = {
        type: 'FeatureCollection',
        features: features.filter(f => !f.properties.is_drop_off_only && (hasCentroids ? f.properties.is_centroid : Number(f.properties.location_type) === 1))
    };

    return { stops, centroids };
};

/** Whether a stop passes the map's stop-type filter; an empty filter passes every stop. */
export const matchesStopTypeFilter = (props: StopProperties | null, stopTypeFilter: readonly string[]): boolean => {
    if (!props || stopTypeFilter.length === 0) return true;
    if (stopTypeFilter.includes('metro') && (props.metro_lines?.length ?? 0) > 0) return true;
    return stopTypeFilter.includes('train') && props.is_train === 1;
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
    const { stop_id, stop_name, platform_code, is_train, metro_lines, lines } = feature.properties;
    return {
        stop_id,
        stop_name,
        platform_code,
        is_train: Number(is_train) === 1 ? 1 : 0,
        metro_lines,
        lines,
        coordinates: feature.geometry.coordinates as [number, number],
    };
};

/** The panel's view of a stop from its map feature. */
export const toSelectedStop = (feature: StopFeature): SelectedStop => ({ ...stopSummary(feature), all_ids: feature.properties.all_ids });

/** A search history entry for a stop picked in `city`. */
export const stopHistoryEntry = (feature: StopFeature, city: string): SearchHistoryBase => ({ type: 'stop', city_slug: city, ...stopSummary(feature) });

/** Every stop and platform id to its feature; a merged station resolves its platforms' ids unless they have their own entry. */
export const indexStopsById = (collection: StopCollection | undefined): Map<string, StopFeature> => {
    const idx = new Map<string, StopFeature>();
    for (const f of collection?.features ?? []) {
        idx.set(f.properties.stop_id, f);
        for (const subId of f.properties.all_ids ?? []) {
            idx.set(subId, f);
        }
        // A merged station's id joins its platforms' ids; each resolves to it unless the platform has its own entry.
        if (f.properties.stop_id.includes(',')) {
            for (const part of f.properties.stop_id.split(',')) {
                if (!idx.has(part)) idx.set(part, f);
            }
        }
    }
    return idx;
};
