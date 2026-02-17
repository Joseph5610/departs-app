
/**
 * Frontend API Endpoints
 */
export const API_ENDPOINTS = {
    VEHICLES: '/api/vehicles',
    VEHICLE_DETAIL: '/api/vehicle-detail',
    STOPS: '/api/stops',
    DEPARTURES: '/api/departures',
    RSS: '/api/rss'
} as const;

/**
 * Query Refresh Intervals
 */
export const REFRESH_INTERVALS = {
    VEHICLES: 10000,
    VEHICLE_DETAIL: 10000,
    DEPARTURES: 15000,
    STOPS: 24 * 60 * 60 * 1000 // 24 hours
} as const;
