import type { CityConfig } from '../../_core/city-config';
import { appClient } from '../../_core/ApiClient';
import { UPSTREAM_TTL_S } from '../../_core/config';
import { CacheManager, MEMORY_CACHE_TTL } from '../../_core/feed/CacheManager';
import { isEmptyRecord } from '../../_core/utils/fields';

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
    (data) => !data || isEmptyRecord(data.routes));
}

/**
 * Contains static mappings from GTFS trip IDs to route IDs, as well as alias resolution.
 */
export interface GtfsTripRoutesData {
    tripRoutes: Record<string, string>;
    tripAliases: Record<string, string | null>;
}

/** A city's trip id -> route id (`trip_routes.json`), for resolving a trip's line. */
export async function getGtfsTripRoutes(city: CityConfig): Promise<Record<string, string>> {
    return getStaticRecord(city, 'trip_routes.json');
}

/**
 * Trip ids of older timetable exports -> the current trip (`trip_aliases.json`), for networks whose
 * realtime feed still uses them (`hasTripAliases`); empty for the rest. Only vehicle matching reads it.
 */
export async function getGtfsTripAliases(city: CityConfig): Promise<Record<string, string | null>> {
    return city.feed?.hasTripAliases ? getStaticRecord(city, 'trip_aliases.json') : {};
}

/** A static data file holding one record, cached per city; an unreadable or empty file is fetched again soon. */
async function getStaticRecord<T>(city: CityConfig, file: string): Promise<Record<string, T>> {
    const staticDataUrl = city.feed?.staticDataUrl;
    if (!staticDataUrl) throw new Error('Missing staticDataUrl in city config');

    return CacheManager.getOrFetch(`gtfs_${file}_${city.slug}`, MEMORY_CACHE_TTL.TWO_HOURS_MS, async () => {
        try {
            const res = await appClient.fetch(`${staticDataUrl}/${city.slug}/${file}`, { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA });
            if (!res.ok) {
                console.error(`Error fetching ${file} for ${city.slug}: ${res.status}`);
                return {};
            }
            return await res.json() as Record<string, T>;
        } catch (e) {
            console.error(`Failed to parse or fetch ${file} for ${city.slug}:`, e);
            return {};
        }
    }, isEmptyRecord);
}
