import { Env } from "./types";

export const GOLEMIO_BASE_URL = "https://api.golemio.cz";

/**
 * Centralized Backend Configuration
 */
export const CACHE_TTL = {
    DEPARTURES: 10,
    VEHICLES: 10,
    VEHICLE_DETAIL: 10,
    STOPS: 86400, // 24h
    RSS_INCIDENTS: 300, // 5m
    RSS_EXCLUSIONS: 3600, // 1h
    GTFS_DATA: 3600, // 1h for the static data fetch process
};

export const TRANSIT_CONFIG = {
    DEPARTURE_LIMIT: 16,
    DEPARTURE_MINUTES_AFTER: 60,
    STOPS_FETCH_LIMIT: 10000,
    STOPS_MAX_OFFSET: 40000,
    JITTER_RADIUS: 0.00012,
    RSS_FEEDS: {
        incidents: 'https://pid.cz/feed/rss-mimoradnosti/',
        exclusions: 'https://pid.cz/feed/rss-vyluky/'
    }
};

/**
 * Standardized Error Messages (Public Facing)
 * Do not mention Golemio directly.
 */
export const ERROR_MESSAGES = {
    GENERIC_INTERNAL: "An unexpected error occurred. Please try again later.",
    UPSTREAM_ERROR: (status: number) => `The data provider returned an error (HTTP ${status}).`,
    MISSING_PARAMS: "Request is missing required parameters.",
    INVALID_STOP_ID: "Provided stop ID is invalid or not found.",
    VEHICLE_NOT_FOUND: "Vehicle information is currently unavailable.",
    RSS_FEED_ERROR: "Could not retrieve transit alerts from the source feed.",
    STOPS_DATA_UNAVAILABLE: "Stop data is currently unavailable.",
};

export interface GolemioFetchOptions {
    cacheTtl?: number;
    searchParams?: Record<string, string | string[]>;
}

/**
 * Standardized fetch for Golemio API.
 * Always appends the provided path to the base Golemio URL.
 * Handles bracket encoding for legacy-compatible query parameters.
 */
export async function golemioFetch(
    path: string,
    env: Env,
    options: GolemioFetchOptions = {}
): Promise<Response> {
    const url = new URL(`${GOLEMIO_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`);

    if (options.searchParams) {
        Object.entries(options.searchParams).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                value.forEach(v => url.searchParams.append(key, v));
            } else {
                url.searchParams.set(key, value);
            }
        });
    }

    // Some providers expect literal brackets in keys (e.g. stopIds[]).
    // URLSearchParams automatically encodes them as %5B and %5D.
    // We convert back to literal brackets ONLY for the keys/params to ensure compatibility.
    const finalUrl = url.toString().replace(/%5B/g, '[').replace(/%5D/g, ']');

    return fetch(finalUrl, {
        headers: {
            "X-Access-Token": env.GOLEMIO_API_KEY,
            "Content-Type": "application/json",
        },
        cf: {
            cacheTtl: options.cacheTtl ?? CACHE_TTL.VEHICLES,
            cacheEverything: true,
        }
    } as any);
}

/**
 * Standardized error response
 */
export function createErrorResponse(message: string, status: number = 500): Response {
    return new Response(JSON.stringify({
        error: true,
        message,
        status
    }), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
        }
    });
}

/**
 * Standardized success response with cache
 */
export function createSuccessResponse(data: any, maxAge: number = 10): Response {
    // For short cache durations, we also set s-maxage for Cloudflare CDN
    const cacheControl = maxAge <= 60
        ? `public, max-age=${maxAge}, s-maxage=${maxAge}`
        : `public, max-age=${maxAge}`;

    return new Response(JSON.stringify(data), {
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": cacheControl,
        }
    });
}
