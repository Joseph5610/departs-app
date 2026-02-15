import { useQuery } from '@tanstack/react-query';
import localforage from 'localforage';
import type { StopCollection, StopFeature } from '../types/transit';
import { METRO_STATIONS } from '../config/stations';
import { API_ENDPOINTS } from '../config/api';

// Configure localforage for IndexedDB
localforage.config({
    name: 'departs',
    storeName: 'stops_cache'
});

const CACHE_KEY = 'pid_stops_geojson_v18'; // Incremented version
const CACHE_TS_KEY = 'pid_stops_updated_at_v18';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export const useStops = () => {
    return useQuery<StopCollection>({
        queryKey: ['stops'],
        queryFn: async () => {
            const now = Date.now();

            const enrichData = (data: StopCollection): StopCollection => {
                if (!data || !data.features) return data;

                data.features.forEach((f: StopFeature) => {
                    const name = f.properties.stop_name;
                    const lines = METRO_STATIONS[name] || [];

                    // @ts-expect-error - Adding runtime properties for map styling expressions
                    f.properties.metro_a = lines.includes('A') ? 1 : 0;
                    // @ts-expect-error - Adding runtime properties for map styling expressions
                    f.properties.metro_b = lines.includes('B') ? 1 : 0;
                    // @ts-expect-error - Adding runtime properties for map styling expressions
                    f.properties.metro_c = lines.includes('C') ? 1 : 0;
                    // @ts-expect-error - Adding runtime properties for map styling expressions
                    f.properties.variant_seed = Math.random();
                });
                return data;
            };

            const cached = await localforage.getItem<StopCollection>(CACHE_KEY);
            const lastUpdate = await localforage.getItem<number>(CACHE_TS_KEY);

            if (cached && lastUpdate && (now - lastUpdate < CACHE_TTL)) {
                return enrichData(cached);
            }

            const res = await fetch(API_ENDPOINTS.STOPS);
            if (!res.ok) {
                if (cached) return enrichData(cached);
                throw new Error('Failed to fetch stops');
            }

            const data = await res.json();
            const enrichedData = enrichData(data);

            await localforage.setItem(CACHE_KEY, enrichedData);
            await localforage.setItem(CACHE_TS_KEY, now);

            return enrichedData;
        },
        staleTime: Infinity,
        gcTime: Infinity,
    });
};
