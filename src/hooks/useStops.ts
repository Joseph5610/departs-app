import { useQuery } from '@tanstack/react-query';
import localforage from 'localforage';

// Configure localforage for IndexedDB
localforage.config({
    name: 'departs',
    storeName: 'stops_cache'
});

const CACHE_KEY = 'pid_stops_geojson_v15'; // Cache version v15
const CACHE_TS_KEY = 'pid_stops_updated_at_v15';
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

import { METRO_STATIONS } from '../config/stations';

export const useStops = () => {
    return useQuery({
        queryKey: ['stops'],
        queryFn: async () => {
            const now = Date.now();

            // Helper to enrich data with Metro flags
            const enrichData = (data: any) => {
                if (!data || !data.features) return data;

                data.features.forEach((f: any) => {
                    const name = f.properties.stop_name;
                    const lines = METRO_STATIONS[name] || [];

                    f.properties.metro_a = lines.includes('A') ? 1 : 0;
                    f.properties.metro_b = lines.includes('B') ? 1 : 0;
                    f.properties.metro_c = lines.includes('C') ? 1 : 0;
                    // Random seed for organic visual variation (0.0 - 1.0)
                    f.properties.variant_seed = Math.random();
                });
                return data;
            };

            // 1. Try to get from IndexedDB
            const cached = await localforage.getItem(CACHE_KEY);
            const lastUpdate = await localforage.getItem<number>(CACHE_TS_KEY);

            // 2. If we have data and it's younger than 24h, use it directly
            if (cached && lastUpdate && (now - lastUpdate < TWENTY_FOUR_HOURS)) {
                console.log('Stops loaded from IndexedDB (Fresh)');
                return enrichData(cached);
            }

            // 3. Otherwise (missing or old), fetch from API
            console.log('Fetching stops from API (Stale or Missing)...');
            const res = await fetch('/api/stops');
            if (!res.ok) {
                // Failsafe: if API fails but we have old data, return old data
                if (cached) {
                    console.log('API failed, returning stale data from cache');
                    return enrichData(cached);
                }
                throw new Error('Failed to fetch stops');
            }

            const data = await res.json();
            const enrichedData = enrichData(data);

            // 4. Save to IndexedDB with timestamp
            await localforage.setItem(CACHE_KEY, enrichedData);
            await localforage.setItem(CACHE_TS_KEY, now);

            return enrichedData;
        },
        staleTime: Infinity,
        gcTime: Infinity,
    });
};
