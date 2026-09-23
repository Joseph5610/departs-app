/**
 * Shared backend configuration.
 *
 * This is the `_core` counterpart to `GTFS_CONFIG` and `GOLEMIO_CONFIG`: values that apply across every
 * network live here, network-specific ones stay in `_feeds/<network>/config.ts`. Kept free of imports on
 * purpose, so any module - including `_core/schemas.ts` - can read it without pulling in the feeds.
 */

/**
 * Centralized Cache TTL Configuration (in seconds).
 */
export const CACHE_TTL = {
    DEPARTURES: 10,
    VEHICLES: 10,
    VEHICLE_DETAIL: 10,
    INFOTEXTS: 900, // 15m
    STOPS: 43200, // 12h (allow morning enrichment updates)
    CITIES: 43200, // 12h
    RSS_INCIDENTS: 300, // 5m
    RSS_EXCLUSIONS: 3600, // 1h
    SITEMAP: 86400, // 24h
    /** How long the edge may keep serving the last good response while the Worker fails (e.g. a CPU kill). */
    STALE_IF_ERROR: 60,
};

/**
 * Cloudflare edge TTLs for upstream fetches of static and schedule data (in seconds).
 * Live upstream feeds reuse the matching `CACHE_TTL` entry instead.
 */
export const UPSTREAM_TTL_S = {
    /**
     * GTFS-RT protobuf. Matches CACHE_TTL.VEHICLES: the in-memory debounce in CacheManager sits on
     * top of this, but this is what actually survives an isolate eviction between them.
     */
    GTFS_RT_FEED: 10,
    /** Per-stop GTFS departure chunks. */
    DEPARTURE_CHUNKS: 3600,
    /** Golemio stop pages, trip windows and the fleet register. */
    SCHEDULE_DATA: 7200,
    /** Routes, stop enrichment, trip stops, shapes and the shape index. */
    STATIC_DATA: 86400,
};

/**
 * How long an MCP tool's answer is reused for an identical call (seconds). Live tools match the
 * `/api` edge TTLs; stop search reads the daily stop list.
 */
export const MCP_CACHE_TTL_S: Record<string, number> = {
    search_stops: 3600,
    search_nearest_stops: 3600,
    get_next_departures: CACHE_TTL.DEPARTURES,
    get_nearest_departures: CACHE_TTL.DEPARTURES,
    get_realtime_vehicles: CACHE_TTL.VEHICLES,
    get_vehicle_detail: CACHE_TTL.VEHICLE_DETAIL,
    get_service_alerts: 60,
};

/** Upper bound on distinct MCP calls kept by the tool result cache. */
export const MCP_CACHE_MAX_ENTRIES = 256;

/** Values the MCP tools fall back to when the client leaves an argument out. */
export const MCP_DEFAULTS = {
    CITY: 'prague',
    RESULT_LIMIT: 10,
    ALERTS_LIMIT: 20,
    VEHICLES_LIMIT: 25,
    NEAREST_STOPS_RADIUS_M: 1000,
    NEAREST_DEPARTURES_RADIUS_M: 500,
    /** How many stops inside the radius get a departure board. */
    NEAREST_DEPARTURES_MAX_STOPS: 5,
    /** How many of the closest stops are used when none lies inside the radius. */
    NEAREST_DEPARTURES_FALLBACK_STOPS: 3,
};

/**
 * Standardized Error Messages (Public Facing).
 * These messages are shown to the user when things go wrong.
 * Note: We avoid mentioning "Golemio" directly in public errors.
 */
export const ERROR_MESSAGES = {
    GENERIC_INTERNAL: "An unexpected error occurred. Please try again later.",
    UPSTREAM_ERROR: (status: number) => `The data provider returned an error (HTTP ${status}).`,
    MISSING_PARAMS: "Request is missing required parameters.",
    INVALID_STOP_ID: "Provided stop ID is invalid or not found.",
    VEHICLE_NOT_FOUND: "Vehicle information is currently unavailable.",
    RSS_FEED_ERROR: "Could not retrieve transit alerts from the source feed.",
    STOPS_DATA_UNAVAILABLE: "Stop data is currently unavailable.",
    VEHICLES_DATA_UNAVAILABLE: "Live vehicle data is currently unavailable.",
    DATA_STRUCTURE_CHANGED: "The data provider changed their data structure unexpectedly.",
};

/**
 * Ceilings on what a single request may ask for, enforced at the Zod boundary.
 *
 * These are network-agnostic: they bound the request itself, before any city sees it. Limits that
 * depend on how one network fetches - the platform count a GTFS departures request expands into, say -
 * belong in that network's config instead.
 */
export const API_LIMITS = {
    /**
     * How many stops one departures request may name. Set well above any realistic favourites list, so
     * it only ever rejects abuse rather than a heavy user.
     */
    DEPARTURE_STOP_IDS: 50,
    FEEDBACK_MESSAGE_MIN_CHARS: 5,
    FEEDBACK_MESSAGE_MAX_CHARS: 2000,
};

/** Per-snapshot builds shared between concurrent requests (vehicle collections, mapped alerts). */
export const DERIVATION_CONFIG = {
    /**
     * A build still pending after this long is raced by a fresh one, since a build whose request was
     * killed or cancelled never settles. Under the app's 10 s request timeout, above a slow cold build.
     */
    ABANDON_MS: 8000,
};
