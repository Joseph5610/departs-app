import { CacheManager } from './CacheManager';

/** What a source returns: the data and when it was read, so age is never guessed. */
export interface Snapshot<T> {
    data: T;
    fetchedAt: number;
}

export interface SourceOptions<T, C = void> {
    /** Cache key, unique per city and feed. */
    key: string;
    ttlMs: number;
    /** Reads the upstream once; null means it could not be read at all. */
    read: (context: C) => Promise<T | null>;
    /** Optional check for data that is technically valid but carries nothing, so the last good answer is kept. */
    isEmpty?: (data: T) => boolean;
}

/**
 * One upstream feed, read at most once per `ttlMs` per isolate.
 *
 * This is the only layer that fetches, decodes and caches; everything above it reads snapshots and
 * never touches the network, which is what keeps a request's cost tied to its answer rather than to
 * the size of the network.
 */
export function createSource<T, C = void>({ key, ttlMs, read, isEmpty }: SourceOptions<T, C>): (context: C) => Promise<Snapshot<T> | null> {
    return (context: C) => CacheManager.getOrFetch<Snapshot<T> | null>(
        key,
        ttlMs,
        async () => {
            const data = await read(context);
            return data === null ? null : { data, fetchedAt: Date.now() };
        },
        (snapshot) => snapshot === null || (isEmpty?.(snapshot.data) ?? false)
    );
}

/** Per-snapshot derived data (indexes, mapped collections), built once and collected with the snapshot. */
export function derive<T, D extends object>(snapshot: Snapshot<T>, cache: WeakMap<object, D>, build: () => D): D {
    const existing = cache.get(snapshot);
    if (existing) return existing;
    const built = build();
    cache.set(snapshot, built);
    return built;
}

/** `derive` for an async build: concurrent callers share one build, and a rejected one is dropped so the next caller retries. */
export function deriveAsync<T, D>(snapshot: Snapshot<T>, cache: WeakMap<object, Promise<D>>, build: () => Promise<D>): Promise<D> {
    const existing = cache.get(snapshot);
    if (existing) return existing;
    const built = build();
    cache.set(snapshot, built);
    built.catch(() => {
        if (cache.get(snapshot) === built) cache.delete(snapshot);
    });
    return built;
}
