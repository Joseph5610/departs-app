/**
 * Golemio API configuration and endpoints.
 */
export const GOLEMIO_API = {
    BASE_URL: 'https://api.golemio.cz/v2',
    PUBLIC_BASE_URL: 'https://api.golemio.cz/v2/public',
    ENDPOINTS: {
        STOPS: '/gtfs/stops',
        DEPARTURES: '/public/departureboards',
        VEHICLE_POSITIONS: '/public/vehiclepositions',
        TRIPS: '/public/gtfs/trips'
    }
} as const;

/**
 * Cache settings for Cloudflare.
 */
export const CACHE_CONFIG = {
    DEFAULT_TTL: 10,
    STOPS_TTL: 86400, // 24 hours
} as const;

/**
 * Pagination and data limits.
 */
export const LIMITS = {
    STOPS_FETCH_LIMIT: 10000,
    STOPS_MAX_OFFSET: 40000,
    DEPARTURES_LIMIT: 16,
    DEPARTURES_MINUTES_AFTER: 60
} as const;
