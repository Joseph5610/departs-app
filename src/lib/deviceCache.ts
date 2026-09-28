import './zod-config';
import { z } from 'zod/mini';
import localforage from 'localforage';
import { experimental_createQueryPersister, type AsyncStorage, type PersistedQuery } from '@tanstack/query-persist-client-core';
import { DEVICE_CACHE } from '../config/constants';
import type { QueryClient } from '@tanstack/react-query';
import { isMeteredConnection, onConnectionChange } from './network';

const store = localforage.createInstance({ name: DEVICE_CACHE.DB_NAME, storeName: DEVICE_CACHE.STORE_NAME });

const persistedQuerySchema = z.object({
    buster: z.string(),
    queryHash: z.string(),
    queryKey: z.array(z.unknown()),
    state: z.looseObject({ data: z.unknown(), dataUpdatedAt: z.number() }),
});

/** Only `data` and `dataUpdatedAt` are restored, so the rest of the state is rebuilt rather than trusted. */
const toPersistedQuery = (value: unknown, parseData: (data: unknown) => unknown): PersistedQuery => {
    const { buster, queryHash, queryKey, state } = persistedQuerySchema.parse(value);
    return {
        buster,
        queryHash,
        queryKey,
        state: {
            data: parseData(state.data),
            dataUpdatedAt: state.dataUpdatedAt,
            dataUpdateCount: 1,
            error: null,
            errorUpdatedAt: 0,
            errorUpdateCount: 0,
            fetchFailureCount: 0,
            fetchFailureReason: null,
            fetchMeta: null,
            isInvalidated: false,
            status: 'success',
            fetchStatus: 'idle',
        },
    };
};

/** Storage failures (private mode, quota) degrade to a plain download, never a failed query. */
const storage: AsyncStorage<unknown> = {
    getItem: async (key) => {
        try {
            return await store.getItem<unknown>(key);
        } catch {
            return null;
        }
    },
    setItem: async (key, value) => {
        try {
            await store.setItem(key, value);
        } catch (error) {
            console.warn('Could not save to the device cache', error);
        }
    },
    removeItem: async (key) => {
        try {
            await store.removeItem(key);
        } catch {
            // An entry that cannot be removed is rejected by its buster or age on the next read.
        }
    },
    entries: async () => {
        const entries: Array<[string, unknown]> = [];
        try {
            await store.iterate<unknown, void>((value, key) => { entries.push([key, value]); });
        } catch {
            return [];
        }
        return entries;
    },
};

const createPersister = (parseData: (data: unknown) => unknown) => experimental_createQueryPersister<unknown>({
    storage,
    buster: DEVICE_CACHE.VERSION,
    maxAge: DEVICE_CACHE.MAX_AGE,
    serialize: (query) => query,
    // A malformed entry throws here and is removed by the persister, falling back to a download.
    deserialize: (value) => toPersistedQuery(value, parseData),
});

const maintenance = createPersister((data) => data);

/**
 * `persister` for a query of static data: the last copy is read from the device (IndexedDB) on a
 * cold start and shown at once, then refreshed in the background once older than the query's `staleTime`.
 * `parseData` must validate the copy like the query's own download, so a copy saved by an older
 * release in a different format is discarded instead of shown.
 */
export const createDevicePersister = (parseData: (data: unknown) => unknown) => createPersister(parseData).persisterFn;

/**
 * `staleTime` for device-cached queries: `ms` normally, but on a metered connection a copy is kept for
 * up to a day, so static data is not downloaded again over mobile data as often.
 */
export const deviceCacheStaleTime = (ms: number) => (): number => (isMeteredConnection() ? Math.max(ms, DEVICE_CACHE.METERED_STALE) : ms);

/** Refreshes device-cached queries left stale by a metered connection once the device moves to an unmetered one. */
export function refreshDeviceCacheWhenUnmetered(queryClient: QueryClient): void {
    onConnectionChange(() => {
        if (isMeteredConnection()) return;
        // Staleness is recomputed here: `stale: true` reuses each observer's result from while still metered.
        void queryClient.refetchQueries({
            type: 'active',
            predicate: (query) => {
                if (query.options.persister === undefined) return false;
                return query.observers.some(({ options: { staleTime } }) =>
                    query.isStaleByTime(typeof staleTime === 'function' ? staleTime(query) : staleTime));
            },
        });
    });
}

/** Drops expired or outdated entries and stores from earlier cache implementations; run once per launch. */
export function pruneDeviceCache(): void {
    void maintenance.persisterGc().catch(() => undefined);
    for (const storeName of DEVICE_CACHE.LEGACY_STORE_NAMES) {
        void localforage.dropInstance({ name: DEVICE_CACHE.DB_NAME, storeName }).catch(() => undefined);
    }
}
