/**
 * Configuration constants for the generic GTFS adapter.
 */
export const GTFS_CONFIG = {
    // Time windows for filtering departures
    DEPARTURES_PAST_WINDOW_MS: 120 * 60 * 1000, // 2 hours
    DEPARTURES_FUTURE_WINDOW_MS: 3 * 60 * 60 * 1000, // 3 hours
    
    // Window to resurrect departed vehicles if backend cache missed
    DEPARTURES_RESURRECT_WINDOW_MS: 15 * 60 * 1000, // 15 mins

    /**
     * Ceiling on the platforms one departures request may resolve to once parent stations are expanded.
     * GTFS-only: this adapter fetches a chunk per distinct stop prefix, so the expanded count is what
     * drives subrequests and JSON parsed. Golemio expands nothing and sends a single upstream call.
     */
    MAX_DEPARTURE_TARGET_STOPS: 200,

    // Stale threshold for live vehicles
    VEHICLES_STALE_THRESHOLD_MS: 10 * 60 * 1000, // 10 minutes

    // Time window before scheduled departure when vehicle is considered "before_track"
    BEFORE_TRACK_WINDOW_MINS: 60,

    // Delay threshold for a "before_track" vehicle to become "before_track_delayed"
    BEFORE_TRACK_DELAY_THRESHOLD_SECS: 60,

    // Fallback route color if none is provided
    DEFAULT_ROUTE_COLOR: '#888888',

    /**
     * Number of buckets the static shape geometry is split across. Shapes are addressed by
     * `shape_id % SHAPE_CHUNK_COUNT`, which keeps every chunk small without needing an index.
     */
    SHAPE_CHUNK_COUNT: 512,

    /** Leading characters of a stop_id that name its departures chunk. */
    DEPARTURES_CHUNK_PREFIX: 4,

    /** Leading characters of a trip_id that name its trips chunk. */
    TRIP_CHUNK_PREFIX: 3,
} as const;

/*
 * Chunk addressing for the three static data sets. Each of these is a contract with the
 * departs-gtfs-data build script: change one side and the Worker requests files that do not exist.
 * They are deliberately different — shapes bucket numerically, the other two by id prefix.
 */

/** stops/<prefix>.json — must match the departures chunking in the build script. */
export function departuresChunkId(stopId: string): string {
    return stopId.substring(0, GTFS_CONFIG.DEPARTURES_CHUNK_PREFIX).toUpperCase();
}

/** trips/<prefix>.json — must match the trip chunking in the build script. */
export function tripChunkId(tripId: string): string {
    return tripId.substring(0, GTFS_CONFIG.TRIP_CHUNK_PREFIX).toUpperCase();
}

/** shape_chunks/<bucket>.json — must match SHAPE_CHUNK_COUNT in the build script. */
export function shapeChunkId(shapeId: string): string {
    const numeric = parseInt(shapeId, 10);
    return String((Number.isNaN(numeric) ? 0 : Math.abs(numeric)) % GTFS_CONFIG.SHAPE_CHUNK_COUNT);
}
