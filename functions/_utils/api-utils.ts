import { Env } from "./types";

export const GOLEMIO_BASE_URL = "https://api.golemio.cz";

export interface GolemioFetchOptions {
    cacheTtl?: number;
    searchParams?: Record<string, string | string[]>;
}

/**
 * Standardized fetch for Golemio API
 */
export async function golemioFetch(
    endpoint: string,
    env: Env,
    options: GolemioFetchOptions = {}
): Promise<Response> {
    const url = new URL(endpoint.startsWith('http') ? endpoint : `${GOLEMIO_BASE_URL}${endpoint}`);

    if (options.searchParams) {
        Object.entries(options.searchParams).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                value.forEach(v => url.searchParams.append(key, v));
            } else {
                url.searchParams.set(key, value);
            }
        });
    }

    return fetch(url.toString(), {
        headers: {
            "X-Access-Token": env.GOLEMIO_API_KEY,
            "Content-Type": "application/json",
        },
        cf: {
            cacheTtl: options.cacheTtl ?? 10,
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
