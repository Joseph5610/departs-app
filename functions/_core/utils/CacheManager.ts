interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

export const CACHE_TTL = {
    TWO_HOURS_MS: 2 * 60 * 60 * 1000,
    TEN_SECONDS_MS: 10 * 1000,
} as const;

const memoryCache = new Map<string, CacheEntry<unknown>>();
const processingPromises = new Map<string, Promise<unknown>>();

export class CacheManager {
    /**
     * Gets a value from memory cache if valid, otherwise fetches it and saves it.
     * Prevents cache stampedes by returning the same Promise to concurrent callers.
     * 
     * @param key Unique key for the cache entry (e.g. 'brno_stops')
     * @param ttlMs Time to live in milliseconds (e.g. 7200 * 1000 for 2 hours)
     * @param fetcher Async function that fetches and returns the fresh data
     * @returns The cached or freshly fetched data
     */
    static async getOrFetch<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
        const now = Date.now();
        const cached = memoryCache.get(key);

        if (cached && now - cached.timestamp < ttlMs) {
            return cached.data as T;
        }

        if (processingPromises.has(key)) {
            return processingPromises.get(key) as Promise<T>;
        }

        const fetchPromise = (async () => {
            try {
                const data = await fetcher();
                memoryCache.set(key, { data, timestamp: Date.now() });
                return data;
            } finally {
                processingPromises.delete(key);
            }
        })();

        processingPromises.set(key, fetchPromise);
        return fetchPromise;
    }

    /**
     * Manually invalidates a cache entry
     */
    static invalidate(key: string) {
        memoryCache.delete(key);
        processingPromises.delete(key);
    }
}
