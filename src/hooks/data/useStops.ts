import { useQuery } from '@tanstack/react-query';
import localforage from 'localforage';
import type { StopCollection, StopFeature } from '../../types/transit';
import { useMemo } from 'react';
import { apiFetch } from '../../lib/api-client';
import { memoizeLast } from '../../lib/memoize';
import type { AppError } from '../../types/error';
import { usePreferencesStore } from '../../state/preferencesStore';
import { QUERY_TIMING_MS, STOPS_DEVICE_CACHE } from '../../config/constants';

localforage.config({
    name: 'departs',
    storeName: 'stops_cache'
});

const VERSIONED_KEY_PREFIX = `${STOPS_DEVICE_CACHE.KEY_PREFIX}${STOPS_DEVICE_CACHE.VERSION}`;

interface CachedStops {
    data: StopCollection;
    updatedAt: number;
}

const readCachedStops = async (key: string): Promise<CachedStops | null> => {
    try {
        return await localforage.getItem<CachedStops>(key);
    } catch (error) {
        console.warn('Stops device cache unavailable, downloading instead', error);
        return null;
    }
};

/** Saves the stops and drops copies left by earlier cache versions. Storage failures never fail the query. */
const writeCachedStops = async (key: string, value: CachedStops): Promise<void> => {
    try {
        await localforage.setItem(key, value);
        const keys = await localforage.keys();
        const stale = keys.filter(k => k.startsWith(STOPS_DEVICE_CACHE.KEY_PREFIX) && !k.startsWith(VERSIONED_KEY_PREFIX));
        await Promise.all(stale.map(k => localforage.removeItem(k)));
    } catch (error) {
        console.warn('Could not save stops to the device cache', error);
    }
};

const splitStops = memoizeLast((collection: StopCollection | undefined) => {
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
 * Fetches the selected city's stops, kept on the device (IndexedDB) for a day to speed up startup.
 * Provides GeoJSON for the map layers and an index resolving any stop or platform ID.
 */
export const useStops = () => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);

    const query = useQuery<CachedStops, AppError>({
        queryKey: ['stops', selectedCity],
        queryFn: async () => {
            const now = Date.now();
            const key = `${VERSIONED_KEY_PREFIX}_${selectedCity}`;
            const cached = await readCachedStops(key);

            if (cached?.data && cached?.updatedAt && (now - cached.updatedAt < QUERY_TIMING_MS.STOPS_DEVICE_CACHE)) {
                return cached;
            }

            const data = await apiFetch<StopCollection>(`/${selectedCity}/stops?v=${STOPS_DEVICE_CACHE.VERSION}`);
            const result = { data, updatedAt: now };
            await writeCachedStops(key, result);
            return result;
        },
        staleTime: QUERY_TIMING_MS.STOPS_DEVICE_CACHE,
        gcTime: Infinity,
    });

    const collection = query.data?.data;
    const { stops, centroids } = splitStops(collection);
    const stopIndex = buildStopIndex(collection);
    const updatedAt = query.data?.updatedAt ?? null;
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
