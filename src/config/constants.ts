
/**
 * UI and Layout constants
 */
export const FALLBACK_ROUTE_COLOR = '#5A5A5A';
export const SIDEBAR_WIDTH = 420;
export const MOBILE_BREAKPOINT = 768;
export const MOBILE_BOTTOM_SHEET_RATIO = 2.2;
export const VEHICLE_ALERTS_PREVIEW_COUNT = 2;

export const MAP_BOUNDS_DEBOUNCE = 800;
export const MAP_MIN_ZOOM_FOR_DATA = 9;

/**
 * Snaps the vehicles request to XYZ map tiles so nearby viewports share edge-cached responses.
 * Tiles are taken at `floor(zoom) - TILE_ZOOM_OFFSET`: a larger offset means a coarser grid,
 * more cache sharing and more vehicles fetched beyond the screen edge.
 */
export const VEHICLE_BOUNDS_GRID = {
    ENABLED: true,
    TILE_ZOOM_OFFSET: 0,
};

/**
 * Animation and interaction constants
 */
export const MAP_ANIMATION_DURATION = 1500;
export const MAP_FLY_DURATION = 2000;
export const MAP_EASE_DURATION = 1000;
export const MAP_STOP_SELECT_ZOOM = 16;
export const MAP_VEHICLE_SELECT_ZOOM = 15;
export const MAP_MIN_STOP_ZOOM = 14;

/**
 * Pulse animation constants for the selected vehicle indicator.
 * Controls the pulsing ring effect around the selected vehicle on the map.
 */
export const PULSE_SPEED_DIVISOR = 350;
export const PULSE_BASE_RADIUS = 28;
export const PULSE_RADIUS_AMPLITUDE = 20;
export const PULSE_BASE_OPACITY = 0.85;
export const PULSE_OPACITY_DIVISOR = 65;

/**
 * API and Transit constants
 */
export const API_BASE_URL = '/api';

/**
 * Average walking speed in m/s (3.6 km/h)
 * Adjusted for urban environments.
 */
export const WALKING_SPEED = 1.0;

/**
 * Distance in meters under which a user is considered to be at a transit stop.
 */
export const AT_STOP_THRESHOLD_METERS = 30;

/**
 * Maximum reasonable walking distance in meters (approx. 10-12 mins walk).
 */
export const MAX_REASONABLE_WALKING_DISTANCE = 750;

/**
 * Buffer time in seconds to account for platform navigation, ticket validation, etc.
 */
export const CATCH_BUFFER = 120;

/**
 * Transit data refresh intervals
 */
export const TRANSIT_REFRESH_S = 10;
export const TRANSIT_REFRESH_MS = TRANSIT_REFRESH_S * 1000;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** React Query timings for the data hooks (in milliseconds). Live polling itself runs on TRANSIT_REFRESH_MS. */
export const QUERY_TIMING_MS = {
    /** A live query older than this is refetched on mount or window focus. */
    LIVE_STALE: 5 * 1000,
    /** How long an unused live query stays in memory, e.g. a vehicle detail that was just closed. */
    LIVE_GC: MINUTE_MS,
    ALERTS_REFRESH: 3 * MINUTE_MS,
    /** Alerts and stop notices older than this are refetched on mount or window focus. */
    NOTICES_STALE: MINUTE_MS,
    /** Stop notices change rarely and the API caches them for 15 min, so polling faster only returns the same copy. */
    INFOTEXTS_REFRESH: 5 * MINUTE_MS,
    CITIES_STALE: HOUR_MS,
    CITIES_GC: DAY_MS,
    /** How long stops kept on the device (IndexedDB) are used before being downloaded again. */
    STOPS_DEVICE_CACHE: DAY_MS,
    /** Points of sale change roughly monthly. */
    POINTS_OF_SALE_STALE: DAY_MS,
    POINTS_OF_SALE_GC: 7 * DAY_MS,
    GEOCODING_STALE: 5 * MINUTE_MS,
};

/** Only departures expected within this window count towards the board's delay statistics. */
export const DELAY_STATS_WINDOW_MS = 30 * MINUTE_MS;

/**
 * Fetch options for polled realtime endpoints. The API's `stale-while-revalidate` would otherwise
 * let the browser answer each poll with the previous response, keeping the UI one poll behind.
 */
export const LIVE_FETCH_OPTIONS: RequestInit = { cache: 'no-store' };

export const ENRICHMENT_SILENCE_TTL_MS = 90_000; // Gate 2: Prune WS patches silent for 90s

export const DATA_SOURCE_URLS = {
    prague: 'https://golemio.cz',
    brno: 'https://data.brno.cz/datasets/379d2e9a7907460c8ca7fda1f3e84328',
    presov: 'https://www.arcgis.com/home/item.html?id=f1033ca6c2f4461d9aba285e1c7cb079',
    lissy: 'https://github.com/Jorgen98/Lissy'
} as const;
