
/** `caches.default`, the Workers edge Cache API - present on Cloudflare, absent in local Node tooling. */
function edgeCache(): Cache | null {
    return typeof caches !== 'undefined' ? caches.default : null;
}

/**
 * A cache key from `key`: an absolute URL (an upstream fetch) is used as-is; anything else (a value
 * this Worker computed, not fetched, e.g. `vehicles_brno`) is namespaced under an internal URL.
 */
function keyRequest(key: string): Request {
    const url = /^https?:\/\//.test(key) ? key : `https://edge-cache.internal/${encodeURIComponent(key)}`;
    return new Request(url, { method: 'GET' });
}

/**
 * Reads an entry from the Workers edge Cache API (`caches.default`), keyed by `key` (a URL for an
 * upstream fetch, or an arbitrary string for a value this Worker computed itself). Null on a miss, an
 * expired entry, or a runtime with no Cache API. This is the one place that touches `caches.default`
 * directly; `ApiClient.fetch`'s own caching and every caller that caches a computed value share it.
 */
export async function readEdgeCache(key: string): Promise<Response | null> {
    const cache = edgeCache();
    if (!cache) return null;
    try {
        return (await cache.match(keyRequest(key))) ?? null;
    } catch (e) {
        console.error(`[edgeCache] read failed for '${key}':`, e);
        return null;
    }
}

/**
 * Stores `response` under `key` for `ttlS` seconds, surviving an isolate eviction within this colo -
 * the Cache API entry does not, so a fresh isolate reads it instead of recomputing from scratch.
 */
export async function writeEdgeCache(key: string, response: Response, ttlS: number): Promise<void> {
    const cache = edgeCache();
    if (!cache) return;
    try {
        const cacheable = new Response(response.body, response);
        cacheable.headers.set('Cache-Control', `s-maxage=${ttlS}`);
        await cache.put(keyRequest(key), cacheable);
    } catch (e) {
        console.error(`[edgeCache] write failed for '${key}':`, e);
    }
}

export interface ApiFetchOptions extends RequestInit {
    /** Custom TTL for Cloudflare cache */
    cacheTtl?: number;
    /** Query parameters to append to the request */
    searchParams?: Record<string, string | string[]>;
    /** Optional custom timeout in ms. Unified default is 8500ms to fit CF Worker limits */
    timeoutMs?: number;
}

/**
 * Unified API Client for handling outbound fetches across all feeds.
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
                const cached = await readEdgeCache(finalUrl);
                if (cached) return cached;

                const response = await fetch(finalUrl, {
                    ...fetchInit,
                    headers,
                    cf: fetchInit.cf ?? { cacheTtl, cacheEverything: true },
                    signal: controller.signal
                });

                if (response.status === 200) {
                    // Await the write so it finishes before the isolate dies, not just fires and drops.
                    await writeEdgeCache(finalUrl, response.clone(), cacheTtl);
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

/**
 * When the upstream generated this response (`Date` minus `Age`), as ISO. Survives cache hits, so two
 * cached responses for different URLs can be ordered by the snapshot they carry.
 */
export function getResponseGeneratedAt(response: Response): string | undefined {
    const date = Date.parse(response.headers.get('Date') ?? '');
    if (Number.isNaN(date)) return undefined;
    const ageSecs = Number(response.headers.get('Age')) || 0;
    return new Date(date - ageSecs * 1000).toISOString();
}

// Export a singleton for generic use cases (GTFS, Kordis)
export const appClient = new ApiClient();
