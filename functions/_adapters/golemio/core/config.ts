/** Golemio-specific constants. Kept out of shared api-utils intentionally. */
export const GOLEMIO_CONFIG = {
    BASE_URL: 'https://api.golemio.cz',
    DEPARTURE_LIMIT: 16,
    DEPARTURE_MINUTES_AFTER: 120,
    STOPS_FETCH_LIMIT: 10000,
    STOPS_MAX_OFFSET: 40000,
    STOPS_SOURCE_URL: 'https://data.pid.cz/stops/json/stops.json',
    RSS_FEEDS: {
        incidents: 'https://pid.cz/feed/rss-mimoradnosti/',
        exclusions: 'https://pid.cz/feed/rss-vyluky/'
    }
} as const;
