interface LruEntry<T> {
    value: T;
    timestamp: number;
}

export interface LruCacheOptions {
    /** Hard ceiling on retained entries. Oldest entries are evicted first. */
    maxEntries: number;
    /** Optional time to live in milliseconds. Omit to keep entries until evicted. */
    ttlMs?: number;
}

/**
 * A size-bounded in-memory cache with least-recently-used eviction.
 *
 * Unlike CacheManager (which retains every key it is given for the lifetime of the
 * isolate), this is intended for keyspaces that are large and unbounded — for example
 * per-shape route geometry, where an isolate could otherwise accumulate every shape
 * in the network and exhaust its memory budget.
 */
export class LruCache<T> {
    private readonly entries = new Map<string, LruEntry<T>>();
    private readonly maxEntries: number;
    private readonly ttlMs?: number;

    constructor(options: LruCacheOptions) {
        this.maxEntries = options.maxEntries;
        this.ttlMs = options.ttlMs;
    }

    get(key: string): T | undefined {
        const entry = this.entries.get(key);
        if (!entry) return undefined;

        if (this.ttlMs !== undefined && Date.now() - entry.timestamp >= this.ttlMs) {
            this.entries.delete(key);
            return undefined;
        }

        // Re-insert to mark this key as most recently used (Map preserves insertion order).
        this.entries.delete(key);
        this.entries.set(key, entry);
        return entry.value;
    }

    set(key: string, value: T): void {
        if (this.entries.has(key)) {
            this.entries.delete(key);
        }

        this.entries.set(key, { value, timestamp: Date.now() });

        while (this.entries.size > this.maxEntries) {
            const oldestKey = this.entries.keys().next().value;
            if (oldestKey === undefined) break;
            this.entries.delete(oldestKey);
        }
    }

    get size(): number {
        return this.entries.size;
    }
}
