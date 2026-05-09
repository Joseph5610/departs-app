import { useQuery } from '@tanstack/react-query';
import localforage from 'localforage';
import type { StopCollection } from '../../types/transit';
import { useMemo } from 'react';
import { apiFetch } from '../../lib/api-client';
import type { AppError } from '../../types/error';

// Configure localforage for IndexedDB
localforage.config({
    name: 'departs',
    storeName: 'stops_cache'
});

const STORAGE_VERSION = 'v41';
const STOP_STORAGE_KEY = `pid_stops_storage_${STORAGE_VERSION}`;
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
    const query = useQuery<StopCollection, AppError>({
        queryKey: ['stops'],
        queryFn: async () => {
            const now = Date.now();
            const cached = await localforage.getItem<CachedStops>(STOP_STORAGE_KEY);

            if (cached?.data && cached?.updatedAt && (now - cached.updatedAt < TWENTY_FOUR_HOURS)) {
                return cached.data;
            }

            // Cache busting via query parameter linked to the storage version
            const data = await apiFetch<StopCollection>(`/api/stops?v=${STORAGE_VERSION}`);

            await localforage.setItem(STOP_STORAGE_KEY, {
                data,
                updatedAt: now
            });

            return data;
        },
        staleTime: Infinity,
        gcTime: Infinity,
    });

    const stops = useMemo(() => {
        if (!query.data || !Array.isArray(query.data.features)) {
            return null;
        }
        return {
            type: 'FeatureCollection',
            features: query.data.features.filter((f) => {
                return !f.properties.is_centroid;
            })
        } as StopCollection;
    }, [query.data]);

    const centroids = useMemo(() => {
        if (!query.data || !Array.isArray(query.data.features)) {
            return null;
        }
        return {
            type: 'FeatureCollection',
            features: query.data.features.filter((f) => {
                return f.properties.is_centroid;
            })
        } as StopCollection;
    }, [query.data]);


    return {
        ...query,
        stops,
        centroids,
        allFeatures: query.data
    };
};
