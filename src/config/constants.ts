
/** Default document title; `index.html` carries the same text for crawlers that don't run JS. */
export const SITE_TITLE = 'departs.app — MHD Praha, Brno & Prešov LIVE';

export const SITE_URL = 'https://departs.app';

/**
 * UI and Layout constants
 */
export const FALLBACK_ROUTE_COLOR = '#5A5A5A';
/** Must equal Tailwind's `md` breakpoint (48rem), which switches the CSS layout at the same width. */
export const MOBILE_BREAKPOINT = 768;
export const MOBILE_BOTTOM_SHEET_RATIO = 2.2;
export const VEHICLE_ALERTS_PREVIEW_COUNT = 2;

export const PREFERENCES_LIMITS = {
    SEARCH_HISTORY: 5,
    FAVORITE_STOPS: 20,
};

export const UI_TIMING_MS = {
    /** Lets the closing modal finish its exit animation before the next one opens. */
    MODAL_SWAP_DELAY: 150,
    /** How long a copy button shows its "copied" state. */
    COPIED_FEEDBACK: 2000,
    /** How long the city switcher glows after the city changes. */
    CITY_SWITCH_HIGHLIGHT: 2000,
    /** Time a service-worker update check waits for a new version before reporting "up to date". */
    UPDATE_CHECK_WAIT: 2500,
};

/** Mobile detail drawer heights as a fraction of the screen; each value must appear in SNAP_POINTS. */
export const DRAWER_SNAP = {
    SNAP_POINTS: [0.18, 0.6, 0.8],
    DEFAULT: 0.6,
};

export const STOP_SEARCH = {
    MIN_QUERY_LENGTH: 2,
    RESULT_LIMIT: 10,
    /** Line badges shown per search result before the rest are cut. */
    LINE_BADGE_LIMIT: 5,
    /** Relevance points; a stop's score is the sum of the rules it matches. */
    SCORES: {
        STOP_ID_EXACT: 2000,
        STOP_ID_PREFIX: 1500,
        NAME_EXACT: 1000,
        NAME_PREFIX: 500,
        TOKENS_IN_ORDER: 250,
        FIRST_TOKEN: 100,
    },
};

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
export const MAP_CAMERA = {
    /** Whole-city view, used when opening or switching a city. */
    CITY_OVERVIEW_ZOOM: 12,
    /** Opening view when restoring the user's last known location. */
    USER_LOCATION_ZOOM: 16,
    STOP_SELECT_ZOOM: 16,
    VEHICLE_SELECT_ZOOM: 15,
    /** A selected stop is never shown below this zoom. */
    MIN_STOP_ZOOM: 14,
    ANIMATION_MS: 1500,
    FLY_MS: 2000,
    EASE_MS: 1000,
    CLUSTER_EXPAND_MS: 500,
};

export const VEHICLE_ANIMATION = {
    /** How long a vehicle slides from its previous to its new position. */
    DURATION_MS: 1000,
    /** Squared degree distance (~1.5 km) beyond which a vehicle snaps instead of sliding. */
    MAX_SLIDE_DISTANCE_SQ: 0.0002,
};

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

/** Public MCP endpoint shown in the AI-integration banner and setup instructions. */
export const MCP_ENDPOINT_URL = `${SITE_URL}/mcp`;

/** Third-party services and project links; hosts here must stay allowed by the CSP in public/_headers. */
export const EXTERNAL_URLS = {
    MAP_STYLES: {
        dark: {
            nolabels: 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json',
            labels: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        },
        light: {
            nolabels: 'https://basemaps.cartocdn.com/gl/voyager-nolabels-gl-style/style.json',
            labels: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
        },
    },
    GEOCODER_API: 'https://photon.komoot.io/api/',
    STATIC_DATA: 'https://data.departs.app',
    SOURCE_REPO: 'https://github.com/joseph5610/departs-app',
    DATA_LICENSE: 'https://creativecommons.org/licenses/by/4.0/',
    WALKING_DIRECTIONS: {
        apple: (lat: number, lon: number) => `maps://?daddr=${lat},${lon}&dirflg=w`,
        google: (lat: number, lon: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`,
    },
};

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
    /** apiFetch aborts a request that hasn't responded within this time. */
    API_REQUEST_TIMEOUT: 10_000,
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

export const GEOCODING_CONFIG = {
    MIN_QUERY_LENGTH: 3,
    /** Photon is a shared public service: one request once typing pauses, not one per keystroke. */
    DEBOUNCE_MS: 300,
    RESULT_LIMIT: 5,
    /** Places kept for resolving the selected place by ID; older entries are dropped. */
    CACHE_LIMIT: 100,
};

export const STOPS_DEVICE_CACHE = {
    /** Bump to invalidate every device's cached stops; it is also sent as `?v=` to bust the CDN cache. */
    VERSION: 'v46',
    KEY_PREFIX: 'city_stops_storage_',
};

export const DEPARTURES_CONFIG = {
    /** Departures stay listed this long after their expected time, while the vehicle may still be at the stop. */
    PAST_GRACE_MS: MINUTE_MS,
    /** Net delay change across the board, in seconds, beyond which the trend reads as worsening or improving. */
    TREND_THRESHOLD_S: 30,
    /** How long a delay change stays visible next to a departure after an update. */
    DELAY_DELTA_VISIBLE_MS: 5000,
    /** Upcoming departures shown on each favourites card. */
    FAVORITE_CARD_COUNT: 2,
    /** Departures shown per direction before the board offers to expand it. */
    VISIBLE_PER_GROUP: 3,
    /** Departures described in the page's structured data. */
    STRUCTURED_DATA_LIMIT: 15,
};

export const GEOLOCATION_TIMING_MS = {
    /** A position younger than this is flown to directly instead of requesting a fresh fix. */
    FRESH_FIX: 10_000,
    WATCH_TIMEOUT: 15_000,
    WATCH_MAX_AGE: 10_000,
    ONE_SHOT_TIMEOUT: 10_000,
    ONE_SHOT_MAX_AGE: 5_000,
};

export const LOCATION_PRIVACY = {
    /** Decimal places kept when the last known position is saved on the device; 3 is roughly 100 m. */
    SAVED_LOCATION_DECIMALS: 3,
};

/** Cloudflare's documented always-pass Turnstile site key; accepted only by the matching test secret. */
const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';

/**
 * Turnstile site key for the feedback and crash-report forms. Falls back to the test key only in
 * development; a build without `VITE_TURNSTILE_SITE_KEY` gets `null` and the forms report feedback as unavailable.
 */
export const TURNSTILE_SITE_KEY: string | null =
    import.meta.env.VITE_TURNSTILE_SITE_KEY || (import.meta.env.DEV ? TURNSTILE_TEST_SITE_KEY : null);

/** Feedback message bounds; the backend rejects anything outside its own `API_LIMITS`, so keep them equal. */
export const FEEDBACK_LIMITS = {
    MESSAGE_MIN_CHARS: 5,
    MESSAGE_MAX_CHARS: 2000,
};

/** Only departures expected within this window count towards the board's delay statistics. */
export const DELAY_STATS_WINDOW_MS = 30 * MINUTE_MS;

/**
 * Fetch options for polled realtime endpoints. The API's `stale-while-revalidate` would otherwise
 * let the browser answer each poll with the previous response, keeping the UI one poll behind.
 */
export const LIVE_FETCH_OPTIONS: RequestInit = { cache: 'no-store' };

export const ENRICHMENT_SILENCE_TTL_MS = 90_000; // Gate 2: Prune WS patches silent for 90s

export const ENRICHMENT_CONFIG = {
    /** Incoming patches are applied to the store in batches at this interval. */
    FLUSH_INTERVAL_MS: 500,
    /** How often patches older than ENRICHMENT_SILENCE_TTL_MS are dropped. */
    PRUNE_INTERVAL_MS: 15_000,
    RECONNECT_BASE_MS: 1000,
    RECONNECT_MAX_MS: 30_000,
};
