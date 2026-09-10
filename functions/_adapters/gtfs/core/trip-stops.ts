import type { CityConfig } from '../../../_core/city-config';
import { appClient } from '../../../_core/ApiClient';
import { CACHE_TTL } from '../../../_core/utils/CacheManager';
import { LruCache } from '../../../_core/utils/LruCache';
import { tripChunkId } from './config';
import type { Station } from '../services/vehicles/types';

/**
 * Static timetable stops, keyed by `${citySlug}:${tripId}`.
 *
 * Static per trip but read from the polled detail endpoint, so without a memo every poll
 * re-fetched and re-parsed the whole trips chunk.
 */
const tripStopsCache = new LruCache<Station[]>({
    maxEntries: 512,
    ttlMs: CACHE_TTL.TWO_HOURS_MS
});

/** Loads a trip's ordered stops from its `trips/<prefix>.json` chunk. Empty when unknown. */
export async function getTripStops(city: CityConfig, tripId: string): Promise<Station[]> {
    const staticDataUrl = city.adapterConfig?.staticDataUrl;
    if (!staticDataUrl) throw new Error('Missing staticDataUrl in city config');

    const cacheKey = `${city.slug}:${tripId}`;
    const cached = tripStopsCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const chunkId = encodeURIComponent(tripChunkId(tripId));
    const tripUrl = `${staticDataUrl}/${city.slug}/trips/${chunkId}.json`;
    try {
        const tripRes = await appClient.fetch(tripUrl, { cf: { cacheTtl: 86400 } });
        if (!tripRes.ok) return [];

        const chunkData = JSON.parse(await tripRes.text()) as Record<string, unknown[]>;
        const tripData = chunkData[tripId];

        if (!tripData) {
            tripStopsCache.set(cacheKey, []);
            return [];
        }

        const stations = tripData.map((st: unknown, idx: number) => {
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
                is_request_stop: s.is_request_stop as boolean | undefined
            };
        });

        tripStopsCache.set(cacheKey, stations);
        return stations;
    } catch (e) {
        console.error('Failed to get trip stops:', e);
        return [];
    }
}
