/** Golemio-specific constants. Kept out of shared api-utils intentionally. */
export const GOLEMIO_CONFIG = {
    BASE_URL: 'https://api.golemio.cz',
    TIMEZONE: 'Europe/Prague',
    DEPARTURE_LIMIT: 20,
    DEPARTURE_MINUTES_AFTER: 120,
    STOPS_FETCH_LIMIT: 10000,
    STOPS_MAX_OFFSET: 40000,
    /** Held connections and through-running built from the PID GTFS, merged by trip id. */
    CONNECTIONS_DATA_URL: 'https://data.departs.app/prague/connections.json',
    /** Route names/types built from the PID GTFS - the same file the frontend reads directly for branding. */
    ROUTES_DATA_URL: 'https://data.departs.app/prague/routes.json',
    FEEDS: {
        exclusions: 'https://pid.cz/feed/rss-vyluky/',
    }
} as const;
