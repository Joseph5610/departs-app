/** Golemio-specific constants. Kept out of shared api-utils intentionally. */
export const GOLEMIO_CONFIG = {
    BASE_URL: 'https://api.golemio.cz',
    TIMEZONE: 'Europe/Prague',
    DEPARTURE_LIMIT: 20,
    DEPARTURE_MINUTES_AFTER: 120,
    STOPS_FETCH_LIMIT: 10000,
    STOPS_MAX_OFFSET: 40000,
    /** Held connections and through-running built from the PID GTFS, hashed by trip id into `<bucket>.json` files. */
    CONNECTION_BUCKETS_URL: 'https://data.departs.app/prague/connection_buckets',
    /** Must match departs-data's `CONNECTION_BUCKET_COUNT`. */
    CONNECTION_BUCKET_COUNT: 256,
    /** Parsed buckets kept per isolate; each is a few KB. */
    CONNECTION_BUCKETS_CACHED: 128,
    FEEDS: {
        exclusions: 'https://pid.cz/feed/rss-vyluky/',
    }
} as const;
