import { ApiError } from "./errors";
import { ZodError } from "zod";
import type { EventContext } from "@cloudflare/workers-types";
import type { Env } from "./types";
import { getCityConfig } from "./city-config";
import { getAdapter, type CityAdapter } from "../_adapters/CityAdapter";
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
 * Converts thrown errors (like ApiError) into standardized JSON Responses.
 */
export function handleError(error: unknown): Response {
    if (error instanceof ZodError) {
        return createErrorResponse("Invalid request parameters", 400);
    }
    if (error instanceof ApiError) {
        return createErrorResponse(error.message, error.status);
    }
    console.error("Unhandled API Error:", error);
    return createErrorResponse(ERROR_MESSAGES.GENERIC_INTERNAL, 500);
}

/**
 * Formats a date into D. M. YYYY HH:mm in the given IANA timezone.
 * Defaults to Europe/Prague for backward compatibility.
 */
export function formatDate(date: Date, timezone = 'Europe/Prague'): string {
    const d = new Intl.DateTimeFormat('cs-CZ', {
        timeZone: timezone,
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
 * Fixes missing spaces after commas (common in Golemio data).
 * TODO: Consider migrating this to a shared text-processing utility.
 */
export function fixCommaSpacing(text: string | undefined | null): string | undefined {
    if (!text) return undefined;
    return text.replace(/,([^\s])/g, ', $1');
}

export const ALLOWED_PATTERNS = [
    /^https:\/\/(www\.)?departs\.app$/,      // Main domain (with or without www)
    /^https:\/\/.*departs-app\.pages\.dev$/, // Cloudflare Pages (all environments)
    /^http:\/\/localhost:\d+$/,              // Localhost
    /^http:\/\/127\.0\.0\.1:\d+$/            // Local IP
];

export const isAllowedOrigin = (origin: string | null): boolean => {
    if (!origin) return false;
    return ALLOWED_PATTERNS.some(pattern => pattern.test(origin));
};

/**
 * Higher-order function to wrap API routes with city context, adapter initialization,
 * error handling, and standardized responses.
 */
export function withCityRoute(
    handler: (adapter: CityAdapter, context: EventContext<Env, string, unknown>) => Promise<unknown>,
    cacheTtl: number
): (context: EventContext<Env, string, unknown>) => Promise<Response> {
    return async (context) => {
        const slug = context.params.city as string;
        
        if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
            return createErrorResponse('Invalid city format', 400);
        }

        const city = getCityConfig(slug);

        if (!city) {
            return createErrorResponse('City not found', 404);
        }

        try {
            const adapter = getAdapter(city);
            const data = await handler(adapter, context);
            return createSuccessResponse(data, cacheTtl);
        } catch (error) {
            return handleError(error);
        }
    };
}
