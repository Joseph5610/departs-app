interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

export const CACHE_TTL = {
    TWO_HOURS_MS: 2 * 60 * 60 * 1000,
    SHORT_DEBOUNCE_MS: 5000, // safety debounce for internal worker caching
} as const;

interface PendingEntry {
    /** Identifies this attempt so it only ever clears its own map entry. */
    id: number;
    promise: Promise<unknown>;
    startedAt: number;
}

/**
 * How long a request will piggyback on another request's in-flight fetch before giving up
 * and fetching independently. A Worker request that is torn down mid-flight (CPU kill or
 * client cancel) leaves a promise that never settles; without this bound every subsequent
 * request queues behind it and the isolate stops serving that key entirely.
 */
const PENDING_WAIT_MS = 3000;

/** How long a pending entry may sit in the map before it is treated as abandoned outright. */
const PENDING_ABANDON_MS = 15000;

const memoryCache = new Map<string, CacheEntry<unknown>>();
const processingPromises = new Map<string, PendingEntry>();

let pendingSequence = 0;

export class CacheManager {
    /**
     * Gets a value from memory cache if valid, otherwise fetches it and saves it.
     * Prevents cache stampedes by sharing one in-flight Promise between concurrent callers.
     * That sharing is time-bounded: see PENDING_WAIT_MS.
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
        let cached = memoryCache.get(key);

        if (cached && now - cached.timestamp < ttlMs) {
            return cached.data as T;
        }

        const pending = processingPromises.get(key);
        if (pending) {
            // Someone is already rebuilding this key. If we hold anything at all, serve it stale
            // rather than waiting or rebuilding in parallel: for a 5s-TTL feed a slightly old answer
            // beats both a 3s stall and N requests each repeating the same expensive work. This is
            // the case that matters under load, when every concurrent request misses at once.
            if (cached) {
                return cached.data as T;
            }

            if (now - pending.startedAt < PENDING_ABANDON_MS) {
                // Nothing to serve, so we do have to wait — but only for a bounded time, because a
                // request torn down mid-flight (CPU kill, client cancel) leaves a promise that
                // never settles.
                const shared = await CacheManager.waitForPending<T>(pending.promise);
                if (shared.settled) {
                    return shared.value;
                }
                console.warn(`[CacheManager] Shared promise for '${key}' did not settle within ${PENDING_WAIT_MS}ms and no stale value is available. Fetching independently.`);
            } else {
                console.warn(`[CacheManager] Shared promise for '${key}' exceeded ${PENDING_ABANDON_MS}ms. Assuming deadlocked from a canceled request. Dropping it.`);
            }

            if (processingPromises.get(key) === pending) {
                processingPromises.delete(key);
            }

            // Waiting is an await point: another request may have populated the cache meanwhile.
            cached = memoryCache.get(key);
            if (cached) {
                return cached.data as T;
            }
        }

        const pendingId = ++pendingSequence;
        // Snapshot for the stale-fallback paths below, so narrowing survives the closure.
        const staleEntry = cached;

        const fetchPromise = (async () => {
            try {
                const data = await fetcher();

                const isInvalid = isFallbackData ? isFallbackData(data) : false;
                const hasValidCache = staleEntry && !(isFallbackData ? isFallbackData(staleEntry.data as T) : false);

                if (isInvalid && hasValidCache) {
                    console.warn(`[CacheManager] Fetcher for '${key}' returned invalid/fallback data. Preserving stale cache.`);
                    // Refresh timestamp with 5s retry window to prevent hammering upstream
                    memoryCache.set(key, { data: staleEntry.data, timestamp: Date.now() - ttlMs + 5000 });
                    return staleEntry.data as T;
                }

                memoryCache.set(key, { data, timestamp: Date.now() });
                return data;
            } catch (err) {
                const hasValidCache = staleEntry && staleEntry.data != null && !(isFallbackData ? isFallbackData(staleEntry.data as T) : false);
                if (hasValidCache) {
                    console.warn(`[CacheManager] Fetcher for '${key}' threw error. Preserving stale cache:`, err);
                    memoryCache.set(key, { data: staleEntry.data, timestamp: Date.now() - ttlMs + 5000 });
                    return staleEntry.data as T;
                }
                throw err;
            } finally {
                // Only clear our own entry: a request that abandoned this promise may already
                // have registered a replacement.
                if (processingPromises.get(key)?.id === pendingId) {
                    processingPromises.delete(key);
                }
            }
        })();

        processingPromises.set(key, { id: pendingId, promise: fetchPromise, startedAt: Date.now() });
        return fetchPromise;
    }

    /**
     * Awaits an in-flight fetch owned by another request, but only for PENDING_WAIT_MS.
     * Rejections propagate; a promise that simply never settles resolves as unsettled so the
     * caller can fall back to its own fetch.
     */
    private static async waitForPending<T>(promise: Promise<unknown>): Promise<{ settled: true, value: T } | { settled: false }> {
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        const timeout = new Promise<{ settled: false }>((resolve) => {
            timeoutId = setTimeout(() => resolve({ settled: false }), PENDING_WAIT_MS);
        });

        try {
            return await Promise.race([
                (promise as Promise<T>).then((value) => ({ settled: true as const, value })),
                timeout
            ]);
        } finally {
            if (timeoutId !== undefined) clearTimeout(timeoutId);
        }
    }

    /**
     * Checks if a valid, unexpired entry exists in the memory cache
     * @param key Unique key for the cache entry
     * @param ttlMs Optional TTL to check against. If omitted, checks if it exists at all.
     */
    static has(key: string, ttlMs?: number): boolean {
        const cached = memoryCache.get(key);
        if (!cached) return false;
        if (ttlMs === undefined) return true;
        return Date.now() - cached.timestamp < ttlMs;
    }

    /**
     * Manually invalidates a cache entry
     */
    static invalidate(key: string) {
        memoryCache.delete(key);
        processingPromises.delete(key);
    }
}
