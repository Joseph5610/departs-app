import { getCityConfig } from '../../../_core/city-config';
import { appClient } from '../../../_core/ApiClient';
import { CacheManager, CACHE_TTL } from '../../../_core/utils/CacheManager';

export interface GtfsRoute {
    name: string;
    short_name?: string;
    type: string | number;
    route_color?: string;
}

export interface GtfsData {
    routes: Record<string, GtfsRoute>;
    tripRoutes: Record<string, string>;
    routesByName: Record<string, GtfsRoute>;
    tripAliases?: Record<string, string | null>;
}

export async function getGtfsData(citySlug: string): Promise<GtfsData> {
    const cityConfig = getCityConfig(citySlug);
    const staticDataUrl = cityConfig?.adapterConfig?.staticDataUrl;
    
    if (!staticDataUrl) throw new Error('Missing staticDataUrl in city config');

    const cacheKey = `gtfs_data_${citySlug}`;

    return CacheManager.getOrFetch(cacheKey, CACHE_TTL.TWO_HOURS_MS, async () => {
        try {
            const fetchPromises = [
                appClient.fetch(`${staticDataUrl}/${citySlug}/routes.json`),
                appClient.fetch(`${staticDataUrl}/${citySlug}/trip_routes.json`)
            ];

            if (cityConfig.adapterConfig?.hasTripAliases) {
                fetchPromises.push(appClient.fetch(`${staticDataUrl}/${citySlug}/trip_aliases.json`).catch(() => new Response(null, { status: 404 })));
            }

            const results = await Promise.all(fetchPromises);
            const rRes = results[0];
            const trRes = results[1];
            const aliasRes = results[2];

            if (!rRes.ok || !trRes.ok) {
                console.error(`Error fetching GTFS static data for ${citySlug}. Routes: ${rRes.status}, TripRoutes: ${trRes.status}`);
                return { routes: {}, tripRoutes: {}, routesByName: {}, tripAliases: {} };
            }

            const routes = await rRes.json() as Record<string, GtfsRoute>;
            const tripRoutes = await trRes.json() as Record<string, string>;
            const tripAliases = (aliasRes && aliasRes.ok) ? await aliasRes.json() as Record<string, string | null> : {};

            const routesByName: Record<string, GtfsRoute> = {};
            for (const rId in routes) {
                const r = routes[rId];
                if (r.short_name) {
                    routesByName[r.short_name.toUpperCase()] = r;
                }
                if (r.name) {
                    routesByName[r.name.toUpperCase()] = r;
                }
            }

            return { routes, tripRoutes, routesByName, tripAliases };
        } catch (e) {
            console.error(`Failed to parse or fetch GTFS static data for ${citySlug}:`, e);
            return { routes: {}, tripRoutes: {}, routesByName: {}, tripAliases: {} };
        }
    });
}
