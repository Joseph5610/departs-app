import '@/lib/zodConfig';
import { z } from 'zod/mini';
import { queryOptions, useQuery } from '@tanstack/react-query';
import type { RouteInfo, StopCollection, StopsFile, AppError } from '@/types';
import { useMemo } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { memoizeLast } from '@/lib/memoize';
import { usePreferencesStore } from '@/state/preferencesStore';
import { EXTERNAL_URLS, QUERY_TIMING_MS, DEVICE_CACHE, STOPS_FILE_VERSION } from '@/config/constants';
import { createDevicePersister, deviceCacheStaleTime } from '@/lib/deviceCache';
import { indexStopsById, splitStopCollection, stopCollectionFromFile } from '@/domain/stops';
import { queryKeys } from '@/lib/queryKeys';
import { routesQueryOptions } from './useRouteMetadata';
import { FRONTEND_CITIES_CONFIG } from '@/config/cities';

/** A city's stop files as fetched, kept on the device; what the app builds from them is derived on every load. */
interface StopFiles {
    file: StopsFile;
    routes: Record<string, RouteInfo>;
}

/** Checks the stop files' shape; departs-data validates every station and platform before publishing them. */
const stopFilesSchema = z.object({
    file: z.looseObject({ version: z.literal(STOPS_FILE_VERSION) }),
    routes: z.record(z.string(), z.looseObject({})),
});

const stopsPersister = createDevicePersister((data): StopFiles => {
    stopFilesSchema.parse(data);
    return data as StopFiles;
});

/** One stop collection per fetched files, shared by every observer of a city (the map, its neighbours' overlay). */
const collections = new WeakMap<StopFiles, StopCollection>();
const selectCollection = (city: string) => (files: StopFiles): StopCollection => {
    let collection = collections.get(files);
    if (!collection) {
        collection = stopCollectionFromFile(files.file, files.routes, FRONTEND_CITIES_CONFIG[city]?.departuresByPlatforms);
        collections.set(files, collection);
    }
    return collection;
};
const selectors = new Map<string, ReturnType<typeof selectCollection>>();
const selectorOf = (city: string) => {
    let selector = selectors.get(city);
    if (!selector) selectors.set(city, selector = selectCollection(city));
    return selector;
};

const splitStops = memoizeLast(splitStopCollection);
const buildStopIndex = memoizeLast(indexStopsById);

export const stopsQueryOptions = (city: string) => queryOptions<StopFiles, AppError, StopCollection>({
    queryKey: queryKeys.stops(city, DEVICE_CACHE.VERSION),
    queryFn: async ({ client, signal }) => {
        const [file, routes] = await Promise.all([
            apiFetch<StopsFile>(`${EXTERNAL_URLS.STATIC_DATA}/${city}/stops.json?v=${DEVICE_CACHE.VERSION}`, { signal }),
            client.query({ ...routesQueryOptions(city), staleTime: 'static' }),
        ]);
        if (file.version !== STOPS_FILE_VERSION) throw new Error(`Unsupported stops.json version for ${city}`);
        return { file, routes };
    },
    select: selectorOf(city),
    staleTime: deviceCacheStaleTime(QUERY_TIMING_MS.STOPS_STALE),
    gcTime: Infinity,
    persister: stopsPersister,
});


/**
 * Fetches the selected city's prebuilt stop list from the static data host, kept on the device (IndexedDB) across launches.
 * Provides GeoJSON for the map layers and an index resolving any stop, platform or station ID.
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
