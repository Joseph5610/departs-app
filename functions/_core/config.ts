/**
 * Shared backend configuration.
 *
 * This is the `_core` counterpart to `GTFS_CONFIG` and `GOLEMIO_CONFIG`: values that apply across every
 * network live here, network-specific ones stay in `_feeds/<network>/config.ts`. Kept free of imports on
 * purpose, so any module - including `_core/schemas.ts` - can read it without pulling in the feeds.
 */

/** Where the departs-data static files live (per-city folders). */
export const STATIC_DATA_CONFIG = {
    BASE_URL: 'https://data.departs.app',
    /** Bump when departs-data renames or moves stops (`stop_index/`, `departure_buckets/`, the stop search index): drops every cached copy at once. */
    INDEX_CACHE_GENERATION: 4,
};

/**
 * Centralized Cache TTL Configuration (in seconds).
 */
export const CACHE_TTL = {
    DEPARTURES: 10,
    VEHICLES: 10,
    VEHICLE_DETAIL: 10,
    INFOTEXTS: 900, // 15m
    CITIES: 43200, // 12h
    RSS_INCIDENTS: 300, // 5m
    RSS_EXCLUSIONS: 3600, // 1h
    SITEMAP: 86400, // 24h
    /** How long the edge may serve the last sitemap while a request rebuilds it in the background. */
    SITEMAP_STALE_WHILE_REVALIDATE: 3600,
    /** How long the edge may keep serving the last sitemap while the Worker fails to rebuild it. */
    SITEMAP_STALE_IF_ERROR: 86400,
    /** How long the edge may keep serving the last good response while the Worker fails (e.g. a CPU kill). */
    STALE_IF_ERROR: 60,
};

/**
 * Cloudflare edge TTLs for upstream fetches of static and schedule data (in seconds).
 * Live upstream feeds reuse the matching `CACHE_TTL` entry instead.
 */
export const UPSTREAM_TTL_S = {
    /** Per-station GTFS departure buckets. */
    DEPARTURE_BUCKETS: 3600,
    /** Golemio stop pages, trip windows and the fleet register. */
    SCHEDULE_DATA: 7200,
    /** Routes, stop enrichment and trip stops. */
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
export const MCP_CACHE_MAX_ENTRIES = 64;

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
    /** The most departures per line and direction a departures request may ask to be cut to. */
    DEPARTURE_PER_LINE_MAX: 10,
    FEEDBACK_MESSAGE_MIN_CHARS: 5,
    FEEDBACK_MESSAGE_MAX_CHARS: 2000,
    /** Feedback and crash reports expire from KV after this; the privacy policy states the same period. */
    FEEDBACK_RETENTION_S: 365 * 24 * 60 * 60,
};

/**
 * Every network's built fleet, edge-cached (`_core/feed/vehicleCache.ts`) so a fresh isolate reads it
 * instead of building its own. Younger than `FRESH_MS`: served as-is. Older: rebuilt, or re-stamped for
 * an unchanged feed, within the request, so no answer lags the feed by more than this.
 */
export const FLEET_CACHE = {
    FRESH_MS: 10_000,
    /** How long a build is kept, and still served when a rebuild fails. */
    STALE_MS: 60_000,
} as const;

/** In-memory feed caching (`CacheManager`). */
export const CACHE_CONFIG = {
    /** While another request refreshes a key for up to this long, callers holding a stale value serve it instead of fetching too. */
    REFRESH_WINDOW_MS: 10_000,
    /** How soon a key holding fallback (failed or empty) data is fetched again, instead of its full TTL. */
    FALLBACK_RETRY_MS: 5000,
};

/** The stop search index MCP tools read (`functions/_feeds/stop-search.ts`, written by departs-data's `writeStopSearch`). */
export const STOP_SEARCH_CONFIG = {
    /** Stops per `stop_details/<block>.json`; must match departs-data's `STOP_DETAILS_BLOCK`. */
    DETAILS_BLOCK: 256,
    /** Detail blocks kept per isolate; one is a few tens of KB. */
    DETAILS_CACHE_MAX_ENTRIES: 64,
    /** Name lengths a match's rank tells apart; longer names tie. */
    MAX_KEYED_NAME_LENGTH: 4096,
    /** Slack on the flat-projection radius check, so a stop the haversine puts just inside is not dropped first. */
    RADIUS_MARGIN: 1.01,
};

/**
 * My trip Web Push: the `RideWatch` Durable Object (one per trip, every device's alerts on it: before the trip leaves
 * the rider's stop and before their exit) and its push sender (`_core/push/webPush.ts`).
 */
export const RIDE_PUSH = {
    /** Notification tag of a ride's exit alerts, with the trip id appended, so `arrived` replaces `next`; the app's own alerts use it too. */
    TAG: 'ride-own',
    /** Notification tag of a boarding alert, with the trip id appended, so `cancelled` replaces `soon` and trips don't replace each other. */
    BOARD_TAG: 'departure-reminder',
    /** Longest lead (minutes before the departure) a boarding alert may ask for: the app's fixed leads or the user's walk. */
    MAX_LEAD_MIN: 60,
    /** Checks start this long before a boarding alert is due (and before the departure, for the exit watch), so the delay is known in time. */
    FIRST_CHECK_BEFORE_MS: 10 * 60_000,
    /** Checks closing in on a boarding alert halve the time left, but never come closer together than this. */
    MIN_CHECK_INTERVAL_MS: 30_000,
    /** A boarding alert due within this is sent now rather than after one more check. */
    SEND_WINDOW_MS: 30_000,
    /** How far ahead a boarding stop may be; a timetable time is compared within one day either way. */
    MAX_AHEAD_MS: 12 * 3600_000,
    /** Placeholder in a boarding alert's texts the minutes left are put into. */
    MINUTES_TOKEN: '{min}',
    /** VAPID `sub` claim; Apple rejects pushes without one. */
    VAPID_SUBJECT: 'mailto:info@departs.app',
    /** How long a VAPID token stays valid; push services refuse more than 24 h. */
    VAPID_EXP_S: 12 * 3600,
    /** `aes128gcm` record size; one record holds any ride notification. */
    RECORD_SIZE: 4096,
    /** How long a push service keeps an undelivered ride alert; later it is no longer true. */
    TTL_S: 120,
    /** Alarm interval while any rider is within `NEAR_STOPS` of their exit. */
    NEAR_INTERVAL_S: 15,
    /** Alarm interval while every rider is further away or the trip has not started. */
    FAR_INTERVAL_S: 90,
    NEAR_STOPS: 2,
    /** A rider older than this, counted from their departure when boarding later, is dropped (the app's `RIDE_CONFIG.MAX_AGE_MS`). */
    MAX_AGE_MS: 4 * 3600_000,
    /** Alarm interval after a failed detail read, doubling with each failure in a row up to `MAX_RETRY_INTERVAL_S`. */
    RETRY_INTERVAL_S: 30,
    MAX_RETRY_INTERVAL_S: 300,
    /** Failed detail reads in a row after which the trip's riders are given up (with the backoff, about an hour). */
    MAX_FAILURES: 20,
    /** The same for a trip whose detail never answered at all, so a made-up trip id costs almost nothing. */
    MAX_FAILURES_UNSEEN: 2,
    /** Largest `/api/[city]/ride` body; a real one is under 1 KB. */
    MAX_BODY_BYTES: 8192,
    /**
     * Notification options per alert, honoured by Android/desktop Chrome and ignored by iOS: `next` stays until
     * dismissed and buzzes hard; `arrived` replaces it (same tag) and still alerts (`renotify`).
     */
    ALERT_OPTIONS: {
        next: { requireInteraction: true, renotify: true, vibrate: [300, 150, 300, 150, 600] },
        arrived: { renotify: true, vibrate: [150] },
        soon: { renotify: true, vibrate: [300, 150, 300] },
        cancelled: { renotify: true, vibrate: [150] },
    },
    /** Riders one trip's Durable Object accepts; more is abuse, not a crowded tram. */
    MAX_RIDERS: 50,
    /** A trip whose vehicle has had no live position this long (it finished or left the feed) is given up. */
    LOST_MS: 10 * 60_000,
} as const;


/** Push services a ride subscription may point at; the ride-push Worker POSTs to nothing else. */
export const PUSH_SERVICE_HOSTS = [/^fcm\.googleapis\.com$/, /^([a-z0-9-]+\.)*push\.apple\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^([a-z0-9-]+\.)*notify\.windows\.com$/];
