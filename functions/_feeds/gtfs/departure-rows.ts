import type { CityConfig } from '../../_core/city-config';
import { appClient } from '../../_core/ApiClient';
import { ERROR_MESSAGES, UPSTREAM_TTL_S } from '../../_core/config';
import { ApiError } from '../../_core/errors';
import { CacheManager, MEMORY_CACHE_TTL } from '../../_core/feed/CacheManager';
import { LruCache } from '../../_core/feed/LruCache';
import { departuresBucketId, GTFS_CONFIG } from './config';
import type { GtfsDepartureTuple } from './types';

/**
 * Departure rows by `${citySlug}:${stopId}`.
 *
 * The rows carry absolute timestamps and are rebuilt daily, so they are static within a request
 * window; only the realtime overlay is time-sensitive. Holding them keeps the 10s departure poll
 * from re-parsing a whole bucket (~100KB) every time.
 */
const rowsByStop = new LruCache<GtfsDepartureTuple[]>({
    maxEntries: GTFS_CONFIG.DEPARTURE_ROWS_CACHE_MAX_ENTRIES,
    ttlMs: MEMORY_CACHE_TTL.TWO_HOURS_MS
});

function staticDataUrl(city: CityConfig): string {
    const url = city.feed?.staticDataUrl;
    if (!url) throw new ApiError(ERROR_MESSAGES.STOPS_DATA_UNAVAILABLE, 502);
    return url;
}

/** Which platforms a station's departures are attached to. */
export function getParentChildMap(city: CityConfig): Promise<Record<string, string[]>> {
    const baseUrl = staticDataUrl(city);
    return CacheManager.getOrFetch(
        `parent_child_map_${city.slug}`,
        MEMORY_CACHE_TTL.TWO_HOURS_MS,
        async () => {
            const res = await appClient.fetch(`${baseUrl}/${city.slug}/parent_child_map.json`, { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA });
            if (!res.ok) throw new ApiError(ERROR_MESSAGES.STOPS_DATA_UNAVAILABLE, 502);
            return await res.json() as Record<string, string[]>;
        }
    );
}

const parentIndexes = new WeakMap<Record<string, string[]>, Map<string, string>>();

/** Each platform's parent station, built once per loaded parent-child map. */
function parentIndexOf(parentChildMap: Record<string, string[]>): Map<string, string> {
    let parentOf = parentIndexes.get(parentChildMap);
    if (parentOf) return parentOf;
    parentOf = new Map();
    for (const parent in parentChildMap) {
        for (const child of parentChildMap[parent]) parentOf.set(child, parent);
    }
    parentIndexes.set(parentChildMap, parentOf);
    return parentOf;
}

/**
 * The timetable rows of the given stops, one subrequest per bucket they share and none for stops
 * already held. A stop the data does not know simply has no rows.
 */
export async function getDepartureRows(city: CityConfig, stopIds: string[]): Promise<Map<string, GtfsDepartureTuple[]>> {
    const baseUrl = staticDataUrl(city);
    const rows = new Map<string, GtfsDepartureTuple[]>();
    const missing: string[] = [];

    for (const id of stopIds) {
        const held = rowsByStop.get(`${city.slug}:${id}`);
        if (held !== undefined) rows.set(id, held);
        else missing.push(id);
    }
    if (missing.length === 0) return rows;

    const parentOf = parentIndexOf(await getParentChildMap(city));
    const byBucket = new Map<string, string[]>();
    for (const id of missing) {
        const bucketId = departuresBucketId(id, parentOf);
        const ids = byBucket.get(bucketId);
        if (ids) ids.push(id);
        else byBucket.set(bucketId, [id]);
    }

    await Promise.all(Array.from(byBucket, async ([bucketId, ids]) => {
        try {
            const res = await appClient.fetch(`${baseUrl}/${city.slug}/departure_buckets/${bucketId}.json`, {
                cacheTtl: UPSTREAM_TTL_S.DEPARTURE_BUCKETS,
                cf: { cacheTtl: UPSTREAM_TTL_S.DEPARTURE_BUCKETS }
            });
            if (!res.ok) return;

            const bucket = JSON.parse(await res.text()) as Record<string, GtfsDepartureTuple[]>;
            for (const id of ids) {
                const tuples = bucket[id] ?? [];
                rowsByStop.set(`${city.slug}:${id}`, tuples);
                rows.set(id, tuples);
            }
        } catch (e) {
            console.error(`Failed to load departures bucket ${bucketId} for ${city.slug}:`, e);
        }
    }));

    return rows;
}
