import { getCityConfig } from '../../../_core/city-config';

export interface GtfsRoute {
    name: string;
    type: string | number;
    route_color?: string;
}

interface CityCache {
    routes: Record<string, GtfsRoute>;
    tripRoutes: Record<string, string>;
    lastFetch: number;
}

const globalCache: Record<string, CityCache> = {};
export async function getGtfsData(citySlug: string): Promise<{ routes: Record<string, GtfsRoute>; tripRoutes: Record<string, string> }> {
    const now = Date.now();
    const cityConfig = getCityConfig(citySlug);
    const staticDataUrl = cityConfig?.adapterConfig?.staticDataUrl;
    
    if (!staticDataUrl) throw new Error('Missing staticDataUrl in city config');
    const cityCache = globalCache[citySlug];

    // Cache for 2 hours locally in the Worker memory
    if (cityCache && now - cityCache.lastFetch < 7200 * 1000) {
        return { routes: cityCache.routes, tripRoutes: cityCache.tripRoutes };
    }

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

        globalCache[citySlug] = {
            routes,
            tripRoutes,
            lastFetch: now
        };

        return { routes, tripRoutes };
    } catch (e) {
        console.error(`Failed to parse or fetch GTFS static data for ${citySlug}:`, e);
        return { routes: {}, tripRoutes: {} };
    }
}
