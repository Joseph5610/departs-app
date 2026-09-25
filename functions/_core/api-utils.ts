import { ApiError } from "./errors";
import { CACHE_TTL, ERROR_MESSAGES } from "./config";
import { ZodError } from "zod";
import type { EventContext } from "@cloudflare/workers-types";
import type { CityRequestContext, Env } from "./types";

/** The city use-case's actual inputs, read off the real Cloudflare request context. */
export function toCityRequestContext(context: EventContext<Env, string, unknown>): CityRequestContext {
    return {
        url: new URL(context.request.url),
        env: context.env,
        waitUntil: (promise) => context.waitUntil(promise),
    };
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
 * Creates a standardized JSON success response with appropriate Cache-Control headers.
 *
 * @param data Data to return in the response body
 * @param maxAge Cache max-age in seconds (default: 10)
 * @returns Response object
 */
export function createSuccessResponse(data: unknown, maxAge: number = 10): Response {
    return createJsonBodyResponse(JSON.stringify(data), maxAge);
}

/**
 * `createSuccessResponse` for a body that is already serialized JSON, such as a cached vehicle snapshot.
 *
 * @param body Serialized JSON body
 * @param maxAge Cache max-age in seconds (default: 10)
 * @returns Response object
 */
export function createJsonBodyResponse(body: BodyInit, maxAge: number = 10): Response {
    // `max-age` governs the browser, `s-maxage` the edge. `stale-while-revalidate` matters most:
    // without it an endpoint whose TTL equals the client's poll interval expires exactly as the next
    // poll arrives, so every poll misses and re-invokes the Function. Capped at 60s so long-lived
    // static responses are never served stale for long.
    const staleWhileRevalidate = Math.min(maxAge, 60);
    // An uncacheable answer (max-age 0, e.g. an offline feed) must not be revived on error either.
    const staleIfError = maxAge > 0 ? `, stale-if-error=${CACHE_TTL.STALE_IF_ERROR}` : '';
    const cacheControl = `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}${staleIfError}`;

    return new Response(body, {
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": cacheControl,
        }
    });
}

const ALLOWED_PATTERNS = [
    /^https:\/\/(www\.)?departs\.app$/,      // Main domain (with or without www)
    /^https:\/\/.*departs-app\.pages\.dev$/, // Cloudflare Pages (all environments)
    /^http:\/\/localhost:\d+$/,              // Localhost
    /^http:\/\/127\.0\.0\.1:\d+$/            // Local IP
];

export const isAllowedOrigin = (origin: string | null): boolean => {
    if (!origin) return false;
    return ALLOWED_PATTERNS.some(pattern => pattern.test(origin));
};
