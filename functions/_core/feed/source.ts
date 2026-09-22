import { awaitShared, CacheManager } from './CacheManager';
import { DERIVATION_CONFIG } from '../config';

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

/** A per-snapshot async build, when it started and whether it has resolved. */
export interface Derivation<D> {
    promise: Promise<D>;
    startedAt: number;
    resolved: boolean;
}

/**
 * `derive` for an async build: concurrent callers share one build, and a rejected one is dropped so the
 * next caller retries. A build pending past `DERIVATION_CONFIG.ABANDON_MS` is raced by a fresh one rather
 * than awaited forever, since one started by a killed or cancelled request never settles.
 */
export function deriveAsync<T, D>(snapshot: Snapshot<T>, cache: WeakMap<object, Derivation<D>>, build: () => Promise<D>): Promise<D> {
    const existing = cache.get(snapshot);
    if (!existing) return startDerivation(snapshot, cache, build);
    if (existing.resolved) return existing.promise;

    const waitMs = Math.max(0, existing.startedAt + DERIVATION_CONFIG.ABANDON_MS - Date.now());
    return awaitShared(existing.promise, waitMs).then((shared) => {
        if (shared.settled) return shared.value;
        if (cache.get(snapshot) !== existing) return deriveAsync(snapshot, cache, build);
        // A slow build may still finish first; whichever does is kept.
        return startDerivation(snapshot, cache, () => Promise.race([existing.promise, build()]));
    });
}

function startDerivation<T, D>(snapshot: Snapshot<T>, cache: WeakMap<object, Derivation<D>>, build: () => Promise<D>): Promise<D> {
    const derivation: Derivation<D> = { promise: build(), startedAt: Date.now(), resolved: false };
    cache.set(snapshot, derivation);
    derivation.promise.then(
        () => { derivation.resolved = true; },
        () => { if (cache.get(snapshot) === derivation) cache.delete(snapshot); }
    );
    return derivation.promise;
}
