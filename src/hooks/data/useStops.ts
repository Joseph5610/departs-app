import '@/lib/zodConfig';
import { z } from 'zod/mini';
import { queryOptions, useQuery } from '@tanstack/react-query';
import type { RouteInfo, SelectedStop, StopModel, StopsFile, AppError } from '@/types';
import { useMemo } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { getOrCreate } from '@/lib/memoize';
import { usePreferencesStore } from '@/state/preferencesStore';
import { EXTERNAL_URLS, QUERY_TIMING_MS, DEVICE_CACHE } from '@/config/constants';
import { createDevicePersister, deviceCacheStaleTime } from '@/lib/deviceCache';
import { buildStopModel, selectStop } from '@/domain/stops';
import { FRONTEND_CITIES_CONFIG } from '@/config/cities';
import { queryKeys } from '@/lib/queryKeys';
import { routesQueryOptions } from './useRouteMetadata';

/** A city's stop files as fetched, kept on the device; what the app builds from them is derived on every load. */
interface StopFiles {
    file: StopsFile;
    routes: Record<string, RouteInfo>;
}

/** Checks the stop files' shape; departs-data validates every station and platform before publishing them. */
const stopFilesSchema = z.object({
    file: z.looseObject({ version: z.literal(DEVICE_CACHE.STOPS_FILE_VERSION) }),
    routes: z.record(z.string(), z.looseObject({})),
});

const stopsPersister = createDevicePersister((data): StopFiles => {
    stopFilesSchema.parse(data);
    return data as StopFiles;
});

/** One stop model per fetched files, shared by every observer of a city (the map, its neighbours' overlay). */
const models = new WeakMap<StopFiles, StopModel>();
const selectModel = (files: StopFiles): StopModel => getOrCreate(models, files, () => buildStopModel(files.file, files.routes));

export const stopsQueryOptions = (city: string) => queryOptions<StopFiles, AppError, StopModel>({
    queryKey: queryKeys.stops(city, DEVICE_CACHE.VERSION),
    queryFn: async ({ client, signal }) => {
        const [file, routes] = await Promise.all([
            apiFetch<StopsFile>(`${EXTERNAL_URLS.STATIC_DATA}/${city}/stops.json?v=${DEVICE_CACHE.VERSION}`, { signal }),
            client.query({ ...routesQueryOptions(city), staleTime: 'static' }),
        ]);
        if (file.version !== DEVICE_CACHE.STOPS_FILE_VERSION) throw new Error(`Unsupported stops.json version for ${city}`);
        return { file, routes };
    },
    select: selectModel,
    staleTime: deviceCacheStaleTime(QUERY_TIMING_MS.STOPS_STALE),
    gcTime: Infinity,
    persister: stopsPersister,
});


/**
 * Fetches the selected city's prebuilt stop list from the static data host, kept on the device (IndexedDB) across launches,
 * as stations holding their platforms, with every id and alias resolving to its stop.
 */
export const useStops = () => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);

    const query = useQuery(stopsQueryOptions(selectedCity));

    const model = query.data ?? null;
    const updatedAt = query.data ? query.dataUpdatedAt : null;
    const isLoading = query.isLoading;

    return useMemo(() => ({ model, updatedAt, isLoading }), [model, updatedAt, isLoading]);
};

/** The stop `stopId` opens in the selected city, with the id its departures are requested by. */
export const useResolvedStop = (stopId: string | null): SelectedStop | null => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { model } = useStops();
    const byPlatforms = !!FRONTEND_CITIES_CONFIG[selectedCity]?.departuresByPlatforms;
    return useMemo(() => (stopId ? selectStop(stopId, model, byPlatforms) : null), [stopId, model, byPlatforms]);
};
