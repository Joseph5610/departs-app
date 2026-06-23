import { getCityConfig } from '../../../_core/city-config';

export interface GtfsRoute {
    name: string;
    short_name?: string;
    type: string | number;
    route_color?: string;
}

import { CacheManager, CACHE_TTL } from '../../../_core/utils/CacheManager';

export async function getGtfsData(citySlug: string): Promise<{ routes: Record<string, GtfsRoute>; tripRoutes: Record<string, string> }> {
    const cityConfig = getCityConfig(citySlug);
    const staticDataUrl = cityConfig?.adapterConfig?.staticDataUrl;
    
    if (!staticDataUrl) throw new Error('Missing staticDataUrl in city config');

    const cacheKey = `gtfs_data_${citySlug}`;

    return CacheManager.getOrFetch(cacheKey, CACHE_TTL.TWO_HOURS_MS, async () => {
        try {
            const [rRes, trRes] = await Promise.all([
                fetch(`${staticDataUrl}/${citySlug}/routes.json`),
                fetch(`${staticDataUrl}/${citySlug}/trip_routes.json`)
            ]);

            if (!rRes.ok || !trRes.ok) {
                console.error(`Error fetching GTFS static data for ${citySlug}. Routes: ${rRes.status}, TripRoutes: ${trRes.status}`);
                return { routes: {}, tripRoutes: {} };
            }

            const routes = await rRes.json() as Record<string, GtfsRoute>;
            const tripRoutes = await trRes.json() as Record<string, string>;

            return { routes, tripRoutes };
        } catch (e) {
            console.error(`Failed to parse or fetch GTFS static data for ${citySlug}:`, e);
            return { routes: {}, tripRoutes: {} };
        }
    });
}
