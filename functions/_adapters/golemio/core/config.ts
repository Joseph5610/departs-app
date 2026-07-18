/** Golemio-specific constants. Kept out of shared api-utils intentionally. */
export const GOLEMIO_CONFIG = {
    BASE_URL: 'https://api.golemio.cz',
    DEPARTURE_LIMIT: 20,
    DEPARTURE_MINUTES_AFTER: 120,
    STOPS_FETCH_LIMIT: 10000,
    STOPS_MAX_OFFSET: 40000,
    ENRICHMENT_DATA_URL: 'https://data.departs.app/prague/stops-enrichment.json',
    FEEDS: {
        exclusions: 'https://pid.cz/feed/rss-vyluky/',
    }
} as const;
