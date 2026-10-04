/**
 * Configuration constants for the GTFS stack (Brno, Prešov, DÚK).
 */
export const GTFS_CONFIG = {
    // Time windows for filtering departures
    DEPARTURES_PAST_WINDOW_MS: 120 * 60 * 1000, // 2 hours
    DEPARTURES_FUTURE_WINDOW_MS: 3 * 60 * 60 * 1000, // 3 hours
    
    // Window to resurrect departed vehicles if backend cache missed
    DEPARTURES_RESURRECT_WINDOW_MS: 15 * 60 * 1000, // 15 mins

    /**
     * Ceiling on the platforms one departures request may resolve to once parent stations are expanded.
     * GTFS-only: this stack fetches a file per distinct station bucket, so the expanded count is what
     * drives subrequests and JSON parsed. Golemio expands nothing and sends a single upstream call.
     */
    MAX_DEPARTURE_TARGET_STOPS: 200,

    // Stale threshold for live vehicles
    VEHICLES_STALE_THRESHOLD_MS: 10 * 60 * 1000, // 10 minutes

    // Time window before scheduled departure when vehicle is considered "before_track"
    BEFORE_TRACK_WINDOW_MINS: 60,

    /**
     * When a vehicle may be matched to a trip: from `BEFORE_MINS` before its start to `AFTER_MINS` after
     * its end. Mirrors departs-data `SCHEDULE_MATCH_WINDOW`, which writes each trip to the `schedule/<HH>.json`
     * of every hour this span touches.
     */
    SCHEDULE_MATCH_WINDOW: { BEFORE_MINS: 240, AFTER_MINS: 240 },

    // Delay threshold for a "before_track" vehicle to become "before_track_delayed"
    BEFORE_TRACK_DELAY_THRESHOLD_SECS: 60,

    /** Files a stop's departures are hashed across (`departure_buckets/`). */
    DEPARTURE_BUCKET_COUNT: 1024,

    /** Files a trip's stops are hashed across (`trip_buckets/`). */
    TRIP_BUCKET_COUNT: 2048,

    /** Single trips' stops kept per isolate; each is a few KB, unlike the bucket it came from. */
    TRIP_STOPS_CACHE_MAX_ENTRIES: 256,
    /** Parsed trip buckets kept per isolate, so a vehicle build reading many trips of one parses it once. */
    TRIP_BUCKETS_CACHE_MAX_ENTRIES: 2,
    /** Stops' departure rows kept per isolate; a busy stop's rows run to tens of KB. */
    DEPARTURE_ROWS_CACHE_MAX_ENTRIES: 128,

    /** Files each stop's station relation is hashed across (`stop_index/`). */
    STOP_INDEX_SHARDS: 256,
    /** Shards one request may read; naming stops across more reads `parent_child_map.json` once instead. */
    STOP_INDEX_MAX_SHARDS: 4,
    /** Parsed `stop_index/` shards kept per isolate, ~2KB each. */
    STOP_INDEX_CACHE_MAX_ENTRIES: 16,
} as const;

/*
 * File addressing for the static data sets the Worker reads. Each is a contract with the
 * departs-data build script: change one side and the Worker requests files that do not exist.
 * Route shapes are read by the app itself (`TRIP_SHAPES_CONFIG` in src/config/constants.ts).
 */

const utf8 = new TextEncoder();

/** FNV-1a (32-bit) of the id's UTF-8 bytes, modulo `count` - must match `bucketOf` in the build script. */
export function bucketOf(id: string, count: number): string {
    let hash = 0x811c9dc5;
    for (const byte of utf8.encode(id)) {
        hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
    }
    return String(hash % count);
}

/** departure_buckets/<bucket>.json, hashed by the stop's parent station so a station's platforms share one file. */
export function departuresBucketId(stopId: string, parentOf: ReadonlyMap<string, string>): string {
    return bucketOf(parentOf.get(stopId) ?? stopId, GTFS_CONFIG.DEPARTURE_BUCKET_COUNT);
}

/** stop_index/<shard>.json */
export function stopIndexShardId(stopId: string): string {
    return bucketOf(stopId, GTFS_CONFIG.STOP_INDEX_SHARDS);
}

/** trip_buckets/<bucket>.json */
export function tripBucketId(tripId: string): string {
    return bucketOf(tripId, GTFS_CONFIG.TRIP_BUCKET_COUNT);
}
