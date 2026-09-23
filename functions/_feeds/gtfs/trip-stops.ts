import type { CityConfig } from '../../_core/city-config';
import { UPSTREAM_TTL_S } from '../../_core/config';
import { appClient } from '../../_core/ApiClient';
import { MEMORY_CACHE_TTL } from '../../_core/feed/CacheManager';
import { LruCache } from '../../_core/feed/LruCache';
import { tripChunkId } from './config';
import type { GtfsTripConnection, Station } from './types';
import type { GtfsContinuation } from './continuations';

/**
 * Trip stops by chunk, keyed by `${citySlug}:${chunkId}`.
 *
 * A chunk holds about twenty trips and is read from the polled vehicle and detail endpoints, so it
 * is kept whole: caching single trips made every new trip fetch and parse its whole chunk again,
 * which on a fresh isolate is one upstream request per vehicle on the map.
 */
const tripChunkCache = new LruCache<Map<string, Station[]>>({
    maxEntries: 64,
    ttlMs: MEMORY_CACHE_TTL.TWO_HOURS_MS
});

/** Whether a stop has a position; stops the static data could not place carry `[0, 0]`. */
export function isLocated(station: Station): boolean {
    return station.coordinates[0] !== 0 || station.coordinates[1] !== 0;
}

/** Loads a trip's ordered stops from its `trips/<prefix>.json` chunk. Empty when unknown. */
export async function getTripStops(city: CityConfig, tripId: string): Promise<Station[]> {
    const staticDataUrl = city.feed?.staticDataUrl;
    if (!staticDataUrl) throw new Error('Missing staticDataUrl in city config');

    const chunkId = tripChunkId(tripId);
    const cacheKey = `${city.slug}:${chunkId}`;
    const cached = tripChunkCache.get(cacheKey);
    if (cached !== undefined) return cached.get(tripId) ?? [];

    const tripUrl = `${staticDataUrl}/${city.slug}/trips/${encodeURIComponent(chunkId)}.json`;
    try {
        const tripRes = await appClient.fetch(tripUrl, { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA, cf: { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA } });
        if (!tripRes.ok) return [];

        const chunkData = JSON.parse(await tripRes.text()) as Record<string, unknown[]>;
        const chunk = new Map<string, Station[]>();
        for (const id in chunkData) {
            chunk.set(id, chunkData[id].map((st: unknown, idx: number) => {
                const s = st as Record<string, unknown>;
                return {
                    id: s.stop_id as string,
                    name: (s.name as string) || 'Unknown',
                    sequence: idx + 1,
                    arrival_time: s.arrival_time as string,
                    departure_time: s.departure_time as string,
                    coordinates: [Number(s.lon) || 0, Number(s.lat) || 0] as [number, number],
                    is_wheelchair_accessible: null,
                    zone_id: s.zone_id as string | null,
                    is_request_stop: s.is_request_stop as boolean | undefined,
                    connections: s.connections as GtfsTripConnection[] | undefined,
                    continues_as: s.continues_as as GtfsContinuation | undefined
                };
            }));
        }

        tripChunkCache.set(cacheKey, chunk);
        return chunk.get(tripId) ?? [];
    } catch (e) {
        console.error('Failed to get trip stops:', e);
        return [];
    }
}
