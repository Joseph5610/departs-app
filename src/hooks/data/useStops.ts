import '../../lib/zod-config';
import { z } from 'zod/mini';
import { queryOptions, useQuery } from '@tanstack/react-query';
import type { StopCollection, StopFeature } from '../../types/transit';
import { useMemo } from 'react';
import { apiFetch } from '../../lib/api-client';
import { memoizeLast } from '../../lib/memoize';
import type { AppError } from '../../types/error';
import { usePreferencesStore } from '../../state/preferencesStore';
import { EXTERNAL_URLS, QUERY_TIMING_MS, DEVICE_CACHE } from '../../config/constants';
import { createDevicePersister, deviceCacheStaleTime } from '../../lib/deviceCache';

/** Checks the structure the map layers and stop index rely on; each stop's other properties are optional. */
const stopsFileSchema = z.object({
    type: z.literal('FeatureCollection'),
    features: z.array(z.looseObject({
        geometry: z.looseObject({ coordinates: z.tuple([z.number(), z.number()]) }),
        properties: z.looseObject({ stop_id: z.string() }),
    })),
});

const stopsPersister = createDevicePersister((data): StopCollection => {
    stopsFileSchema.parse(data);
    return data as StopCollection;
});

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

const splitStops = memoizeLast(splitStopCollection);

export const stopsQueryOptions = (city: string) => queryOptions<StopCollection, AppError>({
    queryKey: ['stops', city, DEVICE_CACHE.VERSION],
    queryFn: () => apiFetch<StopCollection>(`${EXTERNAL_URLS.STATIC_DATA}/${city}/map-stops.json?v=${DEVICE_CACHE.VERSION}`),
    staleTime: deviceCacheStaleTime(QUERY_TIMING_MS.STOPS_STALE),
    gcTime: Infinity,
    persister: stopsPersister,
});

const buildStopIndex = memoizeLast((collection: StopCollection | undefined) => {
    const idx = new Map<string, StopFeature>();
    for (const f of collection?.features ?? []) {
        idx.set(f.properties.stop_id, f);
        for (const subId of f.properties.all_ids ?? []) {
            idx.set(subId, f);
        }
    }
    return idx;
});

/**
 * useStops
 *
 * Fetches the selected city's prebuilt stop list from the static data host, kept on the device (IndexedDB) across launches.
 * Provides GeoJSON for the map layers and an index resolving any stop or platform ID.
 */
export const useStops = () => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);

    const query = useQuery(stopsQueryOptions(selectedCity));

    const collection = query.data;
    const { stops, centroids } = splitStops(collection);
    const stopIndex = buildStopIndex(collection);
    const updatedAt = query.data ? query.dataUpdatedAt : null;
    const isLoading = query.isLoading;

    return useMemo(() => ({
        stops,
        centroids,
        stopIndex,
        allFeatures: collection ?? null,
        updatedAt,
        isLoading,
    }), [stops, centroids, stopIndex, collection, updatedAt, isLoading]);
};
