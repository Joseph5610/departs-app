import type { CityConfig } from '../../_core/city-config';
import { appClient } from '../../_core/ApiClient';
import { ERROR_MESSAGES, UPSTREAM_TTL_S } from '../../_core/config';
import { ApiError } from '../../_core/errors';
import { CacheManager, MEMORY_CACHE_TTL } from '../../_core/feed/CacheManager';
import { LruCache } from '../../_core/feed/LruCache';
import { departuresChunkId } from './config';
import type { GtfsDepartureTuple } from './types';

/**
 * Departure rows by `${citySlug}:${stopId}`.
 *
 * The rows carry absolute timestamps and are rebuilt daily, so they are static within a request
 * window; only the realtime overlay is time-sensitive. Holding them keeps the 10s departure poll
 * from re-parsing a whole chunk (up to ~1.2MB) every time.
 */
const rowsByStop = new LruCache<GtfsDepartureTuple[]>({
    maxEntries: 512,
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
            const res = await appClient.fetch(`${baseUrl}/${city.slug}/parent_child_map.json`);
            if (!res.ok) throw new ApiError(ERROR_MESSAGES.STOPS_DATA_UNAVAILABLE, 502);
            return await res.json() as Record<string, string[]>;
        }
    );
}

/**
 * The timetable rows of the given stops, one subrequest per chunk they share and none for stops
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

    const byChunk = new Map<string, string[]>();
    for (const id of missing) {
        const chunkId = encodeURIComponent(departuresChunkId(id));
        const ids = byChunk.get(chunkId);
        if (ids) ids.push(id);
        else byChunk.set(chunkId, [id]);
    }

    await Promise.all(Array.from(byChunk, async ([chunkId, ids]) => {
        try {
            const res = await appClient.fetch(`${baseUrl}/${city.slug}/departures/${chunkId}.json`, {
                cf: { cacheTtl: UPSTREAM_TTL_S.DEPARTURE_CHUNKS }
            });
            if (!res.ok) return;

            const chunk = JSON.parse(await res.text()) as Record<string, GtfsDepartureTuple[]>;
            for (const id of ids) {
                const tuples = chunk[id] ?? [];
                rowsByStop.set(`${city.slug}:${id}`, tuples);
                rows.set(id, tuples);
            }
        } catch (e) {
            console.error(`Failed to load departures chunk ${chunkId} for ${city.slug}:`, e);
        }
    }));

    return rows;
}
