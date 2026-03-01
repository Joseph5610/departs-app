import { useQuery } from '@tanstack/react-query';
import localforage from 'localforage';
import type { StopCollection, StopFeature } from '../types/transit';
import { METRO_STATIONS } from '../config/stations';

// Configure localforage for IndexedDB
localforage.config({
    name: 'departs',
    storeName: 'stops_cache'
});

const CACHE_KEY = 'pid_stops_geojson_v17';
const CACHE_TS_KEY = 'pid_stops_updated_at_v17';
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export const useStops = () => {
    return useQuery<StopCollection>({
        queryKey: ['stops'],
        queryFn: async () => {
            const now = Date.now();

            const enrichData = (data: StopCollection): StopCollection => {
                if (!data || !data.features) return data;

                data.features.forEach((f: StopFeature) => {
                    const name = f.properties.stop_name;
                    const stopId = String(f.properties.stop_id || '');
                    const lines = METRO_STATIONS[name] || [];

                    // Use a deterministic seed based on stop ID to keep variant styles stable
                    let hash = 0;
                    for (let i = 0; i < stopId.length; i++) {
                        hash = ((hash << 5) - hash) + stopId.charCodeAt(i);
                        hash |= 0;
                    }
                    const seed = Math.abs(hash % 1000) / 1000;

                    f.properties.metro_a = lines.includes('A') ? 1 : 0;
                    f.properties.metro_b = lines.includes('B') ? 1 : 0;
                    f.properties.metro_c = lines.includes('C') ? 1 : 0;
                    f.properties.is_train = stopId.endsWith('Z301') ? 1 : 0;
                    f.properties.variant_seed = seed;
                });
                return data;
            };

            const cached = await localforage.getItem<StopCollection>(CACHE_KEY);
            const lastUpdate = await localforage.getItem<number>(CACHE_TS_KEY);

            if (cached && lastUpdate && (now - lastUpdate < TWENTY_FOUR_HOURS)) {
                return enrichData(cached);
            }

            const res = await fetch('/api/stops');
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
