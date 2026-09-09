/**
 * Configuration constants for the generic GTFS adapter.
 */
export const GTFS_CONFIG = {
    // Time windows for filtering departures
    DEPARTURES_PAST_WINDOW_MS: 120 * 60 * 1000, // 2 hours
    DEPARTURES_FUTURE_WINDOW_MS: 3 * 60 * 60 * 1000, // 3 hours
    
    // Window to resurrect departed vehicles if backend cache missed
    DEPARTURES_RESURRECT_WINDOW_MS: 15 * 60 * 1000, // 15 mins

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
     * MUST match SHAPE_CHUNK_COUNT in the departs-gtfs-data build script.
     */
    SHAPE_CHUNK_COUNT: 512,
} as const;

/** Maps a shape_id to its chunk file name. Must match the data pipeline implementation exactly. */
export function shapeChunkId(shapeId: string): string {
    const numeric = parseInt(shapeId, 10);
    return String((Number.isNaN(numeric) ? 0 : Math.abs(numeric)) % GTFS_CONFIG.SHAPE_CHUNK_COUNT);
}
