import type { CityConfig } from '../../_core/city-config';
import { UPSTREAM_TTL_S } from '../../_core/config';
import { appClient } from '../../_core/ApiClient';
import { MEMORY_CACHE_TTL } from '../../_core/feed/CacheManager';
import { LruCache } from '../../_core/feed/LruCache';
import { isFields } from '../../_core/utils/fields';
import { GTFS_CONFIG, tripBucketId } from './config';
import type { GtfsTripConnection, Station } from './types';
import type { GtfsContinuation } from './continuations';

/** A bucket's trips by id, plus `$days` and `$trips` (departs-data `TripBucketFile`). */
type RawTripBucket = Record<string, unknown>;

/** When and on which days a trip runs, and its route: what a detail needs beyond the stops. */
export interface TripService {
    /** YYYYMMDD service days `dayFlags` refers to; a connection's own `dayFlags` uses the same days. */
    days: string[];
    /** `[start_mins, end_mins, dayFlags]` */
    window: [number, number, number];
    /** Undefined for a trip the timetable gives no route. */
    routeId?: string;
}

/**
 * Stops of single trips, keyed by `${citySlug}:${tripId}` - what every caller reads. Holding whole
 * trip files as `Station` objects instead filled the isolate heap until garbage collection alone
 * overran the CPU limit.
 */
const tripStopsCache = new LruCache<Trip>({
    maxEntries: GTFS_CONFIG.TRIP_STOPS_CACHE_MAX_ENTRIES,
    ttlMs: MEMORY_CACHE_TTL.TWO_HOURS_MS
});

/**
 * The last few buckets as parsed, keyed by `${citySlug}:${bucketId}`, so a vehicle build asking for many
 * trips of one bucket in a row parses it once. Holds parsed buckets only, never a read under way.
 */
const rawBucketCache = new LruCache<RawTripBucket>({
    maxEntries: GTFS_CONFIG.TRIP_BUCKETS_CACHE_MAX_ENTRIES,
    ttlMs: MEMORY_CACHE_TTL.TWO_HOURS_MS
});

async function fetchTripBucket(url: string): Promise<RawTripBucket | null> {
    const res = await appClient.fetch(url, { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA, cf: { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA } });
    if (!res.ok) return null;
    return JSON.parse(await res.text()) as RawTripBucket;
}

/** A bucket's parsed JSON; null when the file cannot be read. */
async function getTripBucket(city: CityConfig, staticDataUrl: string, bucketId: string): Promise<RawTripBucket | null> {
    const key = `${city.slug}:${bucketId}`;
    const held = rawBucketCache.get(key);
    if (held) return held;

    const bucket = await fetchTripBucket(`${staticDataUrl}/${city.slug}/trip_buckets/${bucketId}.json`);
    if (bucket) rawBucketCache.set(key, bucket);
    return bucket;
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

interface Trip {
    stations: Station[];
    service: TripService | null;
}

const NO_TRIP: Trip = { stations: [], service: null };

const isNumber = (v: unknown): v is number => typeof v === 'number';

function readService(bucket: RawTripBucket, tripId: string): TripService | null {
    const days = bucket.$days;
    const trips = bucket.$trips;
    if (!Array.isArray(days) || !isFields(trips)) return null;
    const raw = trips[tripId];
    if (!Array.isArray(raw) || !isNumber(raw[0]) || !isNumber(raw[1]) || !isNumber(raw[2])) return null;
    return { days: days.filter((d): d is string => typeof d === 'string'), window: [raw[0], raw[1], raw[2]], routeId: typeof raw[3] === 'string' && raw[3] ? raw[3] : undefined };
}

/** A trip's ordered stops and service from its `trip_buckets/<bucket>.json` file, read once for both. */
export async function getTrip(city: CityConfig, tripId: string): Promise<Trip> {
    const staticDataUrl = city.feed?.staticDataUrl;
    if (!staticDataUrl) throw new Error('Missing staticDataUrl in city config');

    const cacheKey = `${city.slug}:${tripId}`;
    const cached = tripStopsCache.get(cacheKey);
    if (cached !== undefined) return cached;

    try {
        const bucket = await getTripBucket(city, staticDataUrl, tripBucketId(tripId));
        if (!bucket) return NO_TRIP;

        const raw = bucket[tripId];
        const trip = { stations: Array.isArray(raw) ? raw.map(toStation) : [], service: readService(bucket, tripId) };
        tripStopsCache.set(cacheKey, trip);
        return trip;
    } catch (e) {
        console.error('Failed to get trip stops:', e);
        return NO_TRIP;
    }
}

/** A trip's ordered stops. Empty when unknown. */
export async function getTripStops(city: CityConfig, tripId: string): Promise<Station[]> {
    return (await getTrip(city, tripId)).stations;
}
