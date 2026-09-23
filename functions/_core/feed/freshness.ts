import type { AppVehicleCollection } from '../types';

/**
 * How old a vehicle collection may be before riders are told. Sources keep the last good answer when
 * an upstream fails or a request is killed mid-refresh, which is right for seconds and wrong for
 * minutes: positions from an hour ago look live on the map.
 */
export const FEED_AGE_S = {
    /** Past this, the answer is flagged `stale` and the app says so. */
    STALE: 60,
    /** Past this, the positions are dropped: no map is better than a wrong one. */
    OFFLINE: 300,
} as const;

/**
 * Stamps a collection with the status the app reacts to. The one place that decides it.
 *
 * Services report facts only: the positions they hold and the `last_updated` they carry, or
 * `upstream_offline` when there was nothing to read at all.
 */
export function withFeedAge(collection: AppVehicleCollection, readAt?: number, nowMs: number = Date.now()): AppVehicleCollection {
    if (collection.status === 'upstream_offline') return collection;

    // Age is measured from when we read the source, not from what it claims: a source that stops
    // stamping its answers, or stops changing the stamp, must not make a frozen cache look live.
    const updatedMs = readAt ?? (collection.last_updated ? Date.parse(collection.last_updated) : NaN);
    const status = feedStatusAt(updatedMs, nowMs);

    if (status === 'upstream_offline') {
        return { type: 'FeatureCollection', features: [], status, last_updated: collection.last_updated };
    }
    return { ...collection, status };
}

/** The status a collection last updated at `updatedMs` (NaN: unknown, treated as new) has earned by `nowMs`. */
export function feedStatusAt(updatedMs: number, nowMs: number = Date.now()): NonNullable<AppVehicleCollection['status']> {
    const ageS = Number.isNaN(updatedMs) ? 0 : (nowMs - updatedMs) / 1000;
    if (ageS > FEED_AGE_S.OFFLINE) return 'upstream_offline';
    return ageS > FEED_AGE_S.STALE ? 'stale' : 'ok';
}
