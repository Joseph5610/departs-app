import { CACHE_CONFIG } from '../config';

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

export const MEMORY_CACHE_TTL = {
    ONE_DAY_MS: 24 * 60 * 60 * 1000,
    TWO_HOURS_MS: 2 * 60 * 60 * 1000,
    SHORT_DEBOUNCE_MS: 5000, // safety debounce for internal worker caching
} as const;

const memoryCache = new Map<string, CacheEntry<unknown>>();
/** When a request last started refreshing a key, so others serve the stale value meanwhile. */
const refreshStartedAt = new Map<string, number>();

export class CacheManager {
    /**
     * Gets a value from memory cache if valid, otherwise fetches it and saves it.
     *
     * Only settled values are shared between requests, never an in-flight fetch: on Workers a promise
     * whose I/O belongs to another request never settles once that request ends or is killed. While
     * another request refreshes a key, a caller holding a stale value serves it instead of fetching too.
     *
     * Supports stale-on-error / stale-on-null fallback: If fetching fresh data fails
     * or returns empty/invalid fallback data (e.g. 404 upstream error), previously
     * cached valid data is preserved and returned.
     *
     * @param key Unique key for the cache entry (e.g. 'brno_stops')
     * @param ttlMs Time to live in milliseconds (e.g. 7200 * 1000 for 2 hours)
     * @param fetcher Async function that fetches and returns the fresh data
     * @param isFallbackData Optional predicate to identify empty or offline fallback data
     * @returns The cached or freshly fetched data
     */
    static async getOrFetch<T>(
        key: string,
        ttlMs: number,
        fetcher: () => Promise<T>,
        isFallbackData?: (data: T) => boolean
    ): Promise<T> {
        const now = Date.now();
        const cached = memoryCache.get(key) as CacheEntry<T> | undefined;

        if (cached && now - cached.timestamp < ttlMs) {
            return cached.data;
        }

        const refreshing = refreshStartedAt.get(key);
        if (cached && refreshing !== undefined && now - refreshing < CACHE_CONFIG.REFRESH_WINDOW_MS) {
            return cached.data;
        }

        refreshStartedAt.set(key, now);
        const isFallback = (data: T) => isFallbackData?.(data) ?? false;
        const hasValidCache = cached !== undefined && cached.data != null && !isFallback(cached.data);
        const retrySoon = () => Date.now() - ttlMs + Math.min(CACHE_CONFIG.FALLBACK_RETRY_MS, ttlMs);

        try {
            const data = await fetcher();
            const isInvalid = isFallback(data);

            if (isInvalid && hasValidCache) {
                console.warn(`[CacheManager] Fetcher for '${key}' returned invalid/fallback data. Preserving stale cache.`);
                memoryCache.set(key, { data: cached.data, timestamp: retrySoon() });
                return cached.data;
            }

            // Fallback data with nothing better to serve is returned, but never held for the full TTL.
            memoryCache.set(key, { data, timestamp: isInvalid ? retrySoon() : Date.now() });
            return data;
        } catch (err) {
            if (hasValidCache) {
                console.warn(`[CacheManager] Fetcher for '${key}' threw error. Preserving stale cache:`, err);
                memoryCache.set(key, { data: cached.data, timestamp: retrySoon() });
                return cached.data;
            }
            throw err;
        } finally {
            if (refreshStartedAt.get(key) === now) refreshStartedAt.delete(key);
        }
    }
}
