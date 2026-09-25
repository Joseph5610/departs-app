import type { CityConfig } from '../../_core/city-config';
import { appClient } from '../../_core/ApiClient';
import { UPSTREAM_TTL_S } from '../../_core/config';
import { CacheManager, MEMORY_CACHE_TTL } from '../../_core/feed/CacheManager';

export interface GtfsRoute {
    name: string;
    short_name?: string;
    type: string | number;
}

/**
 * Contains static GTFS route mappings.
 * Separated from trip routes to prevent large JSON payloads from blocking the CPU
 * during endpoints that only require route metadata (e.g. Departures).
 */
export interface GtfsRoutesData {
    routes: Record<string, GtfsRoute>;
}

const routesByNameCache = new WeakMap<Record<string, GtfsRoute>, Record<string, GtfsRoute>>();

/** Uppercased short name and name -> route, built once per cached route table and only for feeds keyed by line number. */
export function getRoutesByName(routes: Record<string, GtfsRoute>): Record<string, GtfsRoute> {
    const cached = routesByNameCache.get(routes);
    if (cached) return cached;
    const byName: Record<string, GtfsRoute> = {};
    for (const rId in routes) {
        const r = routes[rId];
        if (r.short_name) {
            byName[r.short_name.toUpperCase()] = r;
        }
        if (r.name) {
            byName[r.name.toUpperCase()] = r;
        }
    }
    routesByNameCache.set(routes, byName);
    return byName;
}

/**
 * Fetches and caches GTFS routes (routes.json).
 * Used by endpoints that need to resolve route names and types without needing to map live trips.
 * 
 * @param city The city to fetch routes for
 */
export async function getGtfsRoutes(city: CityConfig): Promise<GtfsRoutesData> {
    const citySlug = city.slug;
    const staticDataUrl = city.feed?.staticDataUrl;

    if (!staticDataUrl) throw new Error('Missing staticDataUrl in city config');

    const cacheKey = `gtfs_data_${citySlug}`;

    return CacheManager.getOrFetch(cacheKey, MEMORY_CACHE_TTL.TWO_HOURS_MS, async () => {
        try {
            const rRes = await appClient.fetch(`${staticDataUrl}/${citySlug}/routes.json`, { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA });

            if (!rRes.ok) {
                console.error(`Error fetching GTFS static data for ${citySlug}. Routes: ${rRes.status}`);
                return { routes: {} };
            }

            const routes = await rRes.json() as Record<string, GtfsRoute>;
            return { routes };
        } catch (e) {
            console.error(`Failed to parse or fetch GTFS static data for ${citySlug}:`, e);
            return { routes: {} };
        }
    },
    // An empty route table is an upstream failure, not a valid result. Without this the empty
    // object would be cached for the full TTL and every vehicle would be dropped for two hours.
    (data) => !data || Object.keys(data.routes).length === 0);
}

/**
 * Contains static mappings from GTFS trip IDs to route IDs, as well as alias resolution.
 */
export interface GtfsTripRoutesData {
    tripRoutes: Record<string, string>;
    tripAliases: Record<string, string | null>;
}

/**
 * Fetches and caches GTFS trip routes (trip_routes.json) and aliases.
 * This is a heavier payload (e.g., 350KB for Brno) and is strictly used by endpoints
 * that need to map live vehicle GTFS-RT updates to their underlying routes.
 * 
 * @param city The city to fetch trip routes for
 */
export async function getGtfsTripRoutes(city: CityConfig): Promise<GtfsTripRoutesData> {
    const citySlug = city.slug;
    const staticDataUrl = city.feed?.staticDataUrl;

    if (!staticDataUrl) throw new Error('Missing staticDataUrl in city config');

    const cacheKey = `gtfs_trip_routes_${citySlug}`;

    return CacheManager.getOrFetch(cacheKey, MEMORY_CACHE_TTL.TWO_HOURS_MS, async () => {
        try {
            const fetchPromises = [
                appClient.fetch(`${staticDataUrl}/${citySlug}/trip_routes.json`, { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA })
            ];

            if (city.feed?.hasTripAliases) {
                fetchPromises.push(appClient.fetch(`${staticDataUrl}/${citySlug}/trip_aliases.json`, { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA }).catch(() => new Response(null, { status: 404 })));
            }

            const results = await Promise.all(fetchPromises);
            const trRes = results[0];
            const aliasRes = results[1];

            if (!trRes.ok) {
                console.error(`Error fetching GTFS trip routes for ${citySlug}: ${trRes.status}`);
                return { tripRoutes: {}, tripAliases: {} };
            }

            const tripRoutes = await trRes.json() as Record<string, string>;
            const tripAliases = (aliasRes && aliasRes.ok) ? await aliasRes.json() as Record<string, string | null> : {};

            return { tripRoutes, tripAliases };
        } catch (e) {
            console.error(`Failed to parse or fetch GTFS trip routes for ${citySlug}:`, e);
            return { tripRoutes: {}, tripAliases: {} };
        }
    },
    (data) => !data || Object.keys(data.tripRoutes).length === 0);
}
