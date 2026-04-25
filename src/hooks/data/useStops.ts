import { useQuery } from '@tanstack/react-query';
import localforage from 'localforage';
import type { StopCollection } from '../../types/transit';

// Configure localforage for IndexedDB
localforage.config({
    name: 'departs',
    storeName: 'stops_cache'
});

const CACHE_KEY = 'pid_stops_geojson_v20';
const CACHE_TS_KEY = 'pid_stops_updated_at_v20';
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

import { useMemo } from 'react';

/**
 * useStops
 * 
 * Fetches and caches Prague transit stop data from the backend.
 * Provides GeoJSON features for map rendering and indexing for stop searching.
 * Utilizes localForage for IndexedDB caching to improve startup time.
 */
export const useStops = () => {
    const query = useQuery<StopCollection>({
        queryKey: ['stops'],
        queryFn: async () => {
            const now = Date.now();


            const cached = await localforage.getItem<StopCollection>(CACHE_KEY);
            const lastUpdate = await localforage.getItem<number>(CACHE_TS_KEY);

            if (cached && lastUpdate && (now - lastUpdate < TWENTY_FOUR_HOURS)) {
                return cached;
            }

            const res = await fetch('/api/stops');
            const data = await res.json();

            await localforage.setItem(CACHE_KEY, data);
            await localforage.setItem(CACHE_TS_KEY, now);

            return data;
        },
        staleTime: Infinity,
        gcTime: Infinity,
    });

    const stops = useMemo(() => {
        if (!query.data) {
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
        if (!query.data) {
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
