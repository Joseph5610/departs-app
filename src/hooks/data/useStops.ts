import '@/lib/zodConfig';
import { z } from 'zod/mini';
import { queryOptions, useQuery } from '@tanstack/react-query';
import type { StopCollection, AppError } from '@/types';
import { useMemo } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { memoizeLast } from '@/lib/memoize';
import { usePreferencesStore } from '@/state/preferencesStore';
import { EXTERNAL_URLS, QUERY_TIMING_MS, DEVICE_CACHE } from '@/config/constants';
import { createDevicePersister, deviceCacheStaleTime } from '@/lib/deviceCache';
import { indexStopsById, splitStopCollection } from '@/domain/stops';
import { queryKeys } from '@/lib/queryKeys';

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

const splitStops = memoizeLast(splitStopCollection);
const buildStopIndex = memoizeLast(indexStopsById);

export const stopsQueryOptions = (city: string) => queryOptions<StopCollection, AppError>({
    queryKey: queryKeys.stops(city, DEVICE_CACHE.VERSION),
    queryFn: () => apiFetch<StopCollection>(`${EXTERNAL_URLS.STATIC_DATA}/${city}/map-stops.json?v=${DEVICE_CACHE.VERSION}`),
    staleTime: deviceCacheStaleTime(QUERY_TIMING_MS.STOPS_STALE),
    gcTime: Infinity,
    persister: stopsPersister,
});


/**
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
