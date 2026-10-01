import type { CityConfig } from '../../_core/city-config';
import { appClient } from '../../_core/ApiClient';
import { UPSTREAM_TTL_S } from '../../_core/config';
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
    tripAliases: TripRuns;
}

/** `trip_routes.json` parsed, per city and per text read: a vehicle build reads thousands of its trips. */
const parsedTripRoutes = new Map<string, { text: string; record: Record<string, string> }>();

/** A city's trip id -> route id (`trip_routes.json`), for resolving every vehicle's line. */
export async function getGtfsTripRoutes(city: CityConfig): Promise<Record<string, string> | null> {
    const text = await getStaticFile(city, 'trip_routes.json', (raw) => raw);
    if (text === null) return null;
    const held = parsedTripRoutes.get(city.slug);
    if (held?.text === text) return held.record;
    const record = JSON.parse(text) as Record<string, string>;
    parsedTripRoutes.set(city.slug, { text, record });
    return record;
}

/**
 * One trip's route id, for a request that names a single trip: read straight from the file's text, which
 * on a fresh isolate is an order of magnitude cheaper than parsing the whole table. Any trip the text
 * read does not find is looked up in the parsed table, so the answer never differs from it.
 */
export async function getGtfsTripRoute(city: CityConfig, tripId: string): Promise<string | undefined> {
    const text = await getStaticFile(city, 'trip_routes.json', (raw) => raw);
    if (text === null) return undefined;
    const key = `${JSON.stringify(tripId)}:"`;
    const at = text.indexOf(key);
    if (at > 0 && (text[at - 1] === '{' || text[at - 1] === ',')) {
        const start = at + key.length;
        const end = text.indexOf('"', start);
        const value = text.slice(start, end);
        if (end > 0 && !value.includes('\\')) return value;
    }
    return (await getGtfsTripRoutes(city))?.[tripId];
}

/**
 * Trip ids of older timetable exports -> the current trip (`trip_alias_runs.json`), for networks whose
 * realtime feed still uses them (`hasTripAliases`); empty for the rest. Only vehicle matching reads it.
 */
export async function getGtfsTripAliases(city: CityConfig): Promise<TripRuns> {
    return (city.feed?.hasTripAliases ? await getStaticFile(city, 'trip_alias_runs.json', (text) => new TripRuns(JSON.parse(text) as TripRunsFile)) : null) ?? EMPTY_TRIP_RUNS;
}

/**
 * A static data file read by `parse`, cached per city; null when it is unreadable or empty, and then
 * fetched again soon. Emptiness is judged from the text: asking a parsed table of thousands of keys
 * whether it has any costs as much as listing them all.
 */
async function getStaticFile<T>(city: CityConfig, file: string, parse: (text: string) => T): Promise<T | null> {
    const staticDataUrl = city.feed?.staticDataUrl;
    if (!staticDataUrl) throw new Error('Missing staticDataUrl in city config');

    return CacheManager.getOrFetch(`gtfs_${file}_${city.slug}`, MEMORY_CACHE_TTL.TWO_HOURS_MS, async () => {
        try {
            const res = await appClient.fetch(`${staticDataUrl}/${city.slug}/${file}`, { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA });
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
