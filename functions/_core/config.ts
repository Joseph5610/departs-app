/**
 * Shared backend configuration.
 *
 * This is the `_core` counterpart to `GTFS_CONFIG` and `GOLEMIO_CONFIG`: values that apply across every
 * adapter live here, adapter-specific ones stay in that adapter's own `core/config.ts`. Kept free of
 * imports on purpose, so any module - including `_core/schemas.ts` - can read it without pulling in the
 * adapter graph.
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
};

/**
 * Cloudflare edge TTLs for upstream fetches of static and schedule data (in seconds).
 * Live upstream feeds reuse the matching `CACHE_TTL` entry instead.
 */
export const UPSTREAM_TTL_S = {
    /** GTFS-RT protobuf; the in-memory debounce in CacheManager sits on top of it. */
    GTFS_RT_FEED: 3,
    /** Per-stop GTFS departure chunks. */
    DEPARTURE_CHUNKS: 3600,
    /** Golemio stop pages, trip windows and the fleet register. */
    SCHEDULE_DATA: 7200,
    /** Routes, stop enrichment, trip stops, shapes and the shape index. */
    STATIC_DATA: 86400,
};

/** Values the MCP tools fall back to when the client leaves an argument out. */
export const MCP_DEFAULTS = {
    CITY: 'prague',
    RESULT_LIMIT: 10,
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
 * These are adapter-agnostic: they bound the request itself, before any adapter sees it. Limits that
 * depend on how one adapter fetches - the platform count a GTFS departures request expands into, say -
 * belong in that adapter's config instead.
 */
export const API_LIMITS = {
    /**
     * How many stops one departures request may name. Set well above any realistic favourites list, so
     * it only ever rejects abuse rather than a heavy user.
     */
    DEPARTURE_STOP_IDS: 50,
};
