import { Env } from "./types";

/**
 * Base URL for the Golemio API.
 */
export const GOLEMIO_BASE_URL = "https://api.golemio.cz";

/**
 * Centralized Cache TTL Configuration (in seconds).
 */
export const CACHE_TTL = {
    DEPARTURES: 10,
    VEHICLES: 10,
    VEHICLE_DETAIL: 10,
    INFOTEXTS: 900, // 15m
    STOPS: 86400, // 24h
    RSS_INCIDENTS: 300, // 5m
    RSS_EXCLUSIONS: 3600, // 1h
    GTFS_DATA: 3600, // 1h for the static data fetch process
};

/**
 * Transit-related magic constants and configuration.
 */
export const TRANSIT_CONFIG = {
    DEPARTURE_LIMIT: 16,
    DEPARTURE_MINUTES_AFTER: 120,
    STOPS_FETCH_LIMIT: 10000,
    STOPS_MAX_OFFSET: 40000,
    JITTER_RADIUS: 0.00012,
    RSS_FEEDS: {
        incidents: 'https://pid.cz/feed/rss-mimoradnosti/',
        exclusions: 'https://pid.cz/feed/rss-vyluky/'
    }
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
};

/**
 * Options for the golemioFetch utility.
 */
export interface GolemioFetchOptions {
    /** Custom TTL for Cloudflare cache */
    cacheTtl?: number;
    /** Query parameters to append to the request */
    searchParams?: Record<string, string | string[]>;
}

/**
 * Standardized fetch wrapper for the Golemio API.
 * Automatically handles:
 * - Base URL prepending
 * - API Key injection via headers
 * - Query parameter serialization (including array support)
 * - Cloudflare Cache configuration
 * - Bracket encoding fix for legacy-compatible query parameters
 *
 * @param path API endpoint path (e.g., '/v2/vehiclepositions')
 * @param env Environment variables containing the API key
 * @param options Additional fetch options
 * @returns Promise resolving to a Response object
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
    });
}

/**
 * Creates a standardized JSON error response.
 *
 * @param message Error message to display
 * @param status HTTP status code (default: 500)
 * @returns Response object
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
 * Formats a date into D. M. YYYY HH:mm in Europe/Prague timezone.
 */
export function formatPragueDate(date: Date): string {
    const d = new Intl.DateTimeFormat('cs-CZ', {
        timeZone: 'Europe/Prague',
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
    }).formatToParts(date);

    const get = (type: string) => d.find(p => p.type === type)?.value;
    return `${get('day')}. ${get('month')}. ${get('year')} ${get('hour')?.padStart(2, '0')}:${get('minute')?.padStart(2, '0')}`;
}

/**
 * Creates a standardized JSON success response with appropriate Cache-Control headers.
 *
 * @param data Data to return in the response body
 * @param maxAge Cache max-age in seconds (default: 10)
 * @returns Response object
 */
export function createSuccessResponse(data: unknown, maxAge: number = 10): Response {
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

/**
 * Sanitizes an ID parameter to prevent path traversal or parameter injection.
 * Allows alphanumeric characters, dashes, underscores, and commas.
 */
export function sanitizeId(id: string | null): string | null {
    if (!id) return null;
    return id.replace(/[^a-zA-Z0-9_,-]/g, '');
}
