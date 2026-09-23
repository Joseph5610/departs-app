import type { CityConfig } from '../../_core/city-config';
import { UPSTREAM_TTL_S } from '../../_core/config';
import { appClient } from '../../_core/ApiClient';
import { awaitShared, MEMORY_CACHE_TTL } from '../../_core/feed/CacheManager';
import { LruCache } from '../../_core/feed/LruCache';
import { GTFS_CONFIG, tripBucketId } from './config';
import type { GtfsTripConnection, Station } from './types';
import type { GtfsContinuation } from './continuations';

type RawTripBucket = Record<string, unknown[]>;

/**
 * Stops of single trips, keyed by `${citySlug}:${tripId}` - what every caller reads. Holding whole
 * trip files as `Station` objects instead filled the isolate heap until garbage collection alone
 * overran the CPU limit.
 */
const tripStopsCache = new LruCache<Station[]>({
    maxEntries: GTFS_CONFIG.TRIP_STOPS_CACHE_MAX_ENTRIES,
    ttlMs: MEMORY_CACHE_TTL.TWO_HOURS_MS
});

/**
 * The last few buckets as parsed, keyed by `${citySlug}:${bucketId}` and held as the pending read, so a
 * vehicle build asking for many trips of one bucket, at once or in a row, parses it once.
 */
const rawBucketCache = new LruCache<Promise<RawTripBucket | null>>({
    maxEntries: GTFS_CONFIG.TRIP_BUCKETS_CACHE_MAX_ENTRIES,
    ttlMs: MEMORY_CACHE_TTL.TWO_HOURS_MS
});

async function fetchTripBucket(url: string): Promise<RawTripBucket | null> {
    const res = await appClient.fetch(url, { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA, cf: { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA } });
    if (!res.ok) return null;
    return JSON.parse(await res.text()) as RawTripBucket;
}

/** A bucket's parsed JSON, shared with a read already under way unless that read was abandoned by a killed request. */
async function getTripBucket(city: CityConfig, staticDataUrl: string, bucketId: string): Promise<RawTripBucket | null> {
    const key = `${city.slug}:${bucketId}`;
    const pending = rawBucketCache.get(key);
    if (pending) {
        const shared = await awaitShared(pending);
        if (shared.settled) return shared.value;
    }

    const read = fetchTripBucket(`${staticDataUrl}/${city.slug}/trip_buckets/${bucketId}.json`);
    rawBucketCache.set(key, read);
    read.then(
        (bucket) => { if (bucket === null && rawBucketCache.get(key) === read) rawBucketCache.delete(key); },
        () => { if (rawBucketCache.get(key) === read) rawBucketCache.delete(key); }
    );
    return read;
}

function toStation(st: unknown, idx: number): Station {
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
}

/** Whether a stop has a position; stops the static data could not place carry `[0, 0]`. */
export function isLocated(station: Station): boolean {
    return station.coordinates[0] !== 0 || station.coordinates[1] !== 0;
}

/** Loads a trip's ordered stops from its `trip_buckets/<bucket>.json` file. Empty when unknown. */
export async function getTripStops(city: CityConfig, tripId: string): Promise<Station[]> {
    const staticDataUrl = city.feed?.staticDataUrl;
    if (!staticDataUrl) throw new Error('Missing staticDataUrl in city config');

    const cacheKey = `${city.slug}:${tripId}`;
    const cached = tripStopsCache.get(cacheKey);
    if (cached !== undefined) return cached;

    try {
        const bucket = await getTripBucket(city, staticDataUrl, tripBucketId(tripId));
        if (!bucket) return [];

        const raw = bucket[tripId];
        const stations = Array.isArray(raw) ? raw.map(toStation) : [];
        tripStopsCache.set(cacheKey, stations);
        return stations;
    } catch (e) {
        console.error('Failed to get trip stops:', e);
        return [];
    }
}
