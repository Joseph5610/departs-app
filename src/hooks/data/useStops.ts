import { useQuery } from '@tanstack/react-query';
import localforage from 'localforage';
import type { StopCollection } from '../../types/transit';
import { useMemo } from 'react';
import { apiFetch } from '../../lib/api-client';
import type { AppError } from '../../types/error';
import { usePreferencesStore } from '../../state/preferencesStore';

// Configure localforage for IndexedDB
localforage.config({
    name: 'departs',
    storeName: 'stops_cache'
});

const STORAGE_VERSION = 'v41';
const STOP_STORAGE_KEY = `city_stops_storage_${STORAGE_VERSION}`;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

interface CachedStops {
    data: StopCollection;
    updatedAt: number;
}

/**
 * useStops
 * 
 * Fetches and caches Prague transit stop data from the backend.
 * Provides GeoJSON features for map rendering and indexing for stop searching.
 * Utilizes localForage for IndexedDB caching to improve startup time.
 * Merges data and timestamp into a single storage entry for efficiency.
 */
export const useStops = () => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);

    const query = useQuery<{ data: StopCollection; updatedAt: number }, AppError>({
        queryKey: ['stops', selectedCity],
        queryFn: async () => {
            const now = Date.now();
            const cached = await localforage.getItem<CachedStops>(`${STOP_STORAGE_KEY}_${selectedCity}`);

            if (cached?.data && cached?.updatedAt && (now - cached.updatedAt < TWENTY_FOUR_HOURS)) {
                return cached;
            }

            // Cache busting via query parameter linked to the storage version
            const data = await apiFetch<StopCollection>(`/${selectedCity}/stops?v=${STORAGE_VERSION}`);
            const result = { data, updatedAt: now };

            await localforage.setItem(`${STOP_STORAGE_KEY}_${selectedCity}`, result);

            return result;
        },
        staleTime: Infinity,
        gcTime: Infinity,
    });

    const { stops, centroids } = useMemo(() => {
        if (!query.data?.data || !Array.isArray(query.data.data.features)) {
            return { stops: null, centroids: null };
        }
        
        const features = query.data.data.features;
        const hasCentroids = features.some(f => f.properties.is_centroid);

        const stops = {
            type: 'FeatureCollection',
            features: features.filter(f => hasCentroids ? !f.properties.is_centroid : true)
        } as StopCollection;

        const centroids = {
            type: 'FeatureCollection',
            features: features.filter(f => hasCentroids ? f.properties.is_centroid : Number(f.properties.location_type) === 1)
        } as StopCollection;

        return { stops, centroids };
    }, [query.data]);


    return {
        ...query,
        stops,
        centroids,
        allFeatures: query.data?.data || null,
        updatedAt: query.data?.updatedAt || null
    };
};
