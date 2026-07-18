
export interface ApiFetchOptions extends RequestInit {
    /** Custom TTL for Cloudflare cache */
    cacheTtl?: number;
    /** Query parameters to append to the request */
    searchParams?: Record<string, string | string[]>;
    /** Optional custom timeout in ms. Unified default is 8500ms to fit CF Worker limits */
    timeoutMs?: number;
}

/**
 * Unified API Client for handling outbound fetches across all adapters.
 * Standardizes Timeouts, User-Agents, and Cloudflare caching.
 */
export class ApiClient {
    protected baseUrl?: string;
    protected defaultTimeout = 8500;
    protected defaultHeaders: Record<string, string> = {
        'User-Agent': 'departs-app/1.0'
    };

    constructor(baseUrl?: string) {
        this.baseUrl = baseUrl;
    }

    /**
     * Standardized fetch wrapper.
     */
    async fetch(path: string | URL, options: ApiFetchOptions = {}): Promise<Response> {
        let url: URL;
        if (typeof path === 'string') {
            const fullUrl = this.baseUrl && !path.startsWith('http') 
                ? `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}` 
                : path;
            url = new URL(fullUrl);
        } else {
            url = path;
        }

        if (options.searchParams) {
            Object.entries(options.searchParams).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                    value.forEach(v => url.searchParams.append(key, v));
                } else {
                    url.searchParams.set(key, String(value));
                }
            });
        }

        // Apply Golemio-specific bracket replacements which are generally safe
        const finalUrl = url.toString().replace(/%5B/g, '[').replace(/%5D/g, ']');

        // Merge headers
        const headers = new Headers(this.defaultHeaders);
        if (options.headers) {
            const extraHeaders = new Headers(options.headers);
            extraHeaders.forEach((value, key) => headers.set(key, value));
        }

        const controller = new AbortController();
        const timeoutMs = options.timeoutMs ?? this.defaultTimeout;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        // Strip custom options out of fetchInit
        const fetchInit = { ...options };
        const cacheTtl = fetchInit.cacheTtl;
        delete fetchInit.cacheTtl;
        delete fetchInit.searchParams;
        delete fetchInit.timeoutMs;

        const method = fetchInit.method || 'GET';
        const isCacheableGet = method === 'GET' && cacheTtl !== undefined;

        try {
            if (isCacheableGet) {
                // caches is a global available in CF Workers
                const cache = typeof caches !== 'undefined' ? caches.default : null;
                const cacheKey = new Request(finalUrl, { method: 'GET' });

                if (cache) {
                    const cachedResponse = await cache.match(cacheKey);
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                }

                const response = await fetch(finalUrl, {
                    ...fetchInit,
                    headers,
                    cf: fetchInit.cf ?? { cacheTtl, cacheEverything: true },
                    signal: controller.signal
                });

                if (cache && response.status === 200) {
                    // Cache API requires Cache-Control headers to be set to cache it
                    const responseToCache = new Response(response.clone().body, response);
                    responseToCache.headers.set('Cache-Control', `s-maxage=${cacheTtl}`);
                    
                    // Await the cache put so it finishes before the worker isolates die
                    await cache.put(cacheKey, responseToCache).catch((e: unknown) => console.error("Cache put error:", e));
                }

                return response;
            } else {
                const response = await fetch(finalUrl, {
                    ...fetchInit,
                    headers,
                    cf: fetchInit.cf,
                    signal: controller.signal
                });
                return response;
            }
        } finally {
            clearTimeout(timeoutId);
        }
    }
}

// Export a singleton for generic use cases (GTFS, Kordis)
export const appClient = new ApiClient();
