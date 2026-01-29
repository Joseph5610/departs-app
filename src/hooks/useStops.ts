import { useQuery } from '@tanstack/react-query';
import localforage from 'localforage';

// Configure localforage for IndexedDB
localforage.config({
    name: 'nextstop',
    storeName: 'stops_cache'
});

const CACHE_KEY = 'pid_stops_geojson_v13'; // Cache version v13 (Force refresh)
const CACHE_TS_KEY = 'pid_stops_updated_at_v13';
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export const useStops = () => {
    return useQuery({
        queryKey: ['stops'],
        queryFn: async () => {
            const now = Date.now();

            // 1. Try to get from IndexedDB
            const cached = await localforage.getItem(CACHE_KEY);
            const lastUpdate = await localforage.getItem<number>(CACHE_TS_KEY);

            // 2. If we have data and it's younger than 24h, use it directly
            if (cached && lastUpdate && (now - lastUpdate < TWENTY_FOUR_HOURS)) {
                console.log('Stops loaded from IndexedDB (Fresh)');
                return cached;
            }

            // 3. Otherwise (missing or old), fetch from API
            console.log('Fetching stops from API (Stale or Missing)...');
            const res = await fetch(`/api/stops?t=${now}`); // Cache busting
            if (!res.ok) {
                // Failsafe: if API fails but we have old data, return old data
                if (cached) {
                    console.log('API failed, returning stale data from cache');
                    return cached;
                }
                throw new Error('Failed to fetch stops');
            }

            const data = await res.json();

            // 4. Save to IndexedDB with timestamp
            await localforage.setItem(CACHE_KEY, data);
            await localforage.setItem(CACHE_TS_KEY, now);

            return data;
        },
        staleTime: Infinity,
        gcTime: Infinity,
    });
};
