import { ApiError } from "./errors";
import { CACHE_TTL, ERROR_MESSAGES } from "./config";
import { $ZodError } from "zod/v4/core";
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
    if (error instanceof $ZodError) {
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
/** A request's JSON body (null when it isn't JSON), or a 413 response when it is larger than `maxBytes`. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
    if (Number(request.headers.get('Content-Length') ?? 0) > maxBytes) return createErrorResponse('Payload too large.', 413);
    const raw = await request.text();
    if (raw.length > maxBytes) return createErrorResponse('Payload too large.', 413);
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/** Hands a validated command to a watch Durable Object and answers the client; `refused` is the message for the watch's 429. */
export async function forwardToWatch(namespace: DurableObjectNamespace, name: string, command: unknown, { refused, failed }: { refused: string; failed: string }): Promise<Response> {
    const response = await namespace.get(namespace.idFromName(name)).fetch('https://watch.internal/', { method: 'POST', body: JSON.stringify(command) });
    if (response.status === 429) return createErrorResponse(refused, 429);
    return response.ok ? createSuccessResponse({ ok: true }, 0) : createErrorResponse(failed, 502);
}

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
    // Without `stale-while-revalidate` (capped at 60s), a TTL equal to the poll interval expires as each poll arrives.
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

const LOCAL_ORIGIN_PATTERNS = [
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/
];

/** The app's own host (whatever domain serves this deployment) or a local dev server. */
export const isAllowedOrigin = (origin: string | null, requestUrl: string): boolean => {
    if (!origin) return false;
    return origin === new URL(requestUrl).origin || LOCAL_ORIGIN_PATTERNS.some(pattern => pattern.test(origin));
};
