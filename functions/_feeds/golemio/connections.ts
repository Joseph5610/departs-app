import { GOLEMIO_CONFIG } from "./config";
import { UPSTREAM_TTL_S } from "../../_core/config";
import { MEMORY_CACHE_TTL } from "../../_core/feed/CacheManager";
import { LruCache } from "../../_core/feed/LruCache";
import { bucketOf } from "../gtfs/config";
import { appClient } from '../../_core/ApiClient';

/** `[to_trip_id, line, route_type, headsign, departure_time, min_transfer_s, max_wait_s, dayFlags]` */
type OnwardRow = [string, string, string, string, string, number, number, number];
/** `[from_trip_id, line, route_type, arrival_ms, min_transfer_s, max_wait_s]` - one row per day the feeder trip runs, timestamp already resolved to that day. */
export type FeederRow = [string, string, string, number, number, number];
/** `[trip_id, line, route_type, headsign, departure_time]` */
export type ContinuationRow = [string, string, string, string, string];

export interface TripConnections {
    d: number;
    /** By `stop_sequence`: Golemio's trip detail keeps GTFS sequences but omits stop ids. */
    out?: Record<string, OnwardRow[]>;
    in?: Record<string, FeederRow[]>;
    continues?: ContinuationRow;
}

/** `prague/connections.json`, built by departs-data from the PID GTFS. */
export interface LiveConnections {
    days: string[];
    trips: Record<string, TripConnections>;
}

const buckets = new LruCache<LiveConnections>({ maxEntries: GOLEMIO_CONFIG.CONNECTION_BUCKETS_CACHED, ttlMs: MEMORY_CACHE_TTL.TWO_HOURS_MS });

/** One bucket file; null when it cannot be read. Only parsed files are kept, never a read under way. */
async function getBucket(bucketId: string): Promise<LiveConnections | null> {
    const held = buckets.get(bucketId);
    if (held) return held;
    try {
        const res = await appClient.fetch(`${GOLEMIO_CONFIG.CONNECTION_BUCKETS_URL}/${bucketId}.json`, { cf: { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA } });
        if (!res.ok) {
            console.error(`Failed to fetch Prague connection bucket ${bucketId}:`, res.status);
            return null;
        }
        const bucket = JSON.parse(await res.text()) as LiveConnections;
        buckets.set(bucketId, bucket);
        return bucket;
    } catch (e) {
        console.error(`Failed to load Prague connection bucket ${bucketId}:`, e);
        return null;
    }
}

/**
 * The connections of the given trips, read from only the buckets holding them: a board or a detail
 * names a handful of the network's trips. Null when none could be read, which leaves departures and
 * trip detail exactly as Golemio returns them.
 */
export async function getLiveConnections(tripIds: Iterable<string | undefined>): Promise<LiveConnections | null> {
    const bucketIds = new Set<string>();
    for (const tripId of tripIds) if (tripId) bucketIds.add(bucketOf(tripId, GOLEMIO_CONFIG.CONNECTION_BUCKET_COUNT));

    const files = (await Promise.all(Array.from(bucketIds, getBucket))).filter((file): file is LiveConnections => file !== null);
    if (files.length === 0) return null;
    if (files.length === 1) return files[0];
    return { days: files[0].days, trips: Object.assign({}, ...files.map(file => file.trips)) };
}
