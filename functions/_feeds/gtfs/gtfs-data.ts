import type { CityConfig } from '../../_core/city-config';
import { appClient } from '../../_core/ApiClient';
import { UPSTREAM_TTL_S, STATIC_DATA_CONFIG } from '../../_core/config';
import { CacheManager, MEMORY_CACHE_TTL } from '../../_core/feed/CacheManager';
import { EMPTY_TRIP_RUNS, TripRuns, type TripRunsFile } from './trip-runs';

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
    const cacheKey = `gtfs_data_${citySlug}`;

    return CacheManager.getOrFetch(cacheKey, MEMORY_CACHE_TTL.TWO_HOURS_MS, async () => {
        try {
            const rRes = await appClient.fetch(`${STATIC_DATA_CONFIG.BASE_URL}/${citySlug}/routes.json`, { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA });

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
 * Trip ids of older timetable exports -> the current trip (`feed_index/trip_alias_runs.json`), for networks whose
 * realtime feed still uses them (`hasTripAliases`); empty for the rest. Only vehicle matching reads it.
 */
export async function getGtfsTripAliases(city: CityConfig): Promise<TripRuns> {
    return (city.feed?.hasTripAliases ? await getStaticFile(city, 'feed_index/trip_alias_runs.json', (text) => new TripRuns(JSON.parse(text) as TripRunsFile)) : null) ?? EMPTY_TRIP_RUNS;
}

/**
 * A static data file read by `parse`, cached per city; null when it is unreadable or empty, and then
 * fetched again soon. Emptiness is judged from the text: asking a parsed table of thousands of keys
 * whether it has any costs as much as listing them all.
 */
async function getStaticFile<T>(city: CityConfig, file: string, parse: (text: string) => T): Promise<T | null> {
    return CacheManager.getOrFetch(`gtfs_${file}_${city.slug}`, MEMORY_CACHE_TTL.TWO_HOURS_MS, async () => {
        try {
            const res = await appClient.fetch(`${STATIC_DATA_CONFIG.BASE_URL}/${city.slug}/${file}`, { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA });
            if (!res.ok) {
                console.error(`Error fetching ${file} for ${city.slug}: ${res.status}`);
                return null;
            }
            const text = await res.text();
            return text.trim() === '{}' ? null : parse(text);
        } catch (e) {
            console.error(`Failed to parse or fetch ${file} for ${city.slug}:`, e);
            return null;
        }
    }, (data) => data === null);
}
