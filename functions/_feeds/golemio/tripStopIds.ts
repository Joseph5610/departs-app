import * as z from 'zod/mini';
import type { Env } from '../../_core/types';
import { UPSTREAM_TTL_S } from '../../_core/config';
import { MEMORY_CACHE_TTL } from '../../_core/feed/cacheManager';
import { LruCache } from '../../_core/feed/LruCache';
import { golemioClient } from './GolemioClient';
import { GOLEMIO_CONFIG } from './config';

const tripStopTimesSchema = z.lazy(() => z.object({
    stop_times: z.array(z.object({
        stop_id: z.string(),
        stop_sequence: z.number(),
    })),
}));

/** Stop id by stop sequence, per trip id. */
const stopIdsByTrip = new LruCache<Map<number, string>>({
    maxEntries: GOLEMIO_CONFIG.TRIP_STOP_IDS_CACHED,
    ttlMs: MEMORY_CACHE_TTL.TWO_HOURS_MS
});

const NO_STOP_IDS = new Map<number, string>();

/** Trips whose lookup just failed, so a detail refreshed every few seconds doesn't refetch them. */
const failedTrips = new LruCache<true>({
    maxEntries: GOLEMIO_CONFIG.TRIP_STOP_IDS_CACHED,
    ttlMs: GOLEMIO_CONFIG.TRIP_STOP_IDS_RETRY_MS
});

/**
 * A trip's GTFS stop ids by stop sequence, from Golemio's GTFS trip endpoint: its public trip and
 * vehicle-position endpoints leave `stop_id` empty. Empty when the trip is unknown or the read fails.
 */
export async function getTripStopIds(env: Env, tripId: string): Promise<Map<number, string>> {
    const held = stopIdsByTrip.get(tripId);
    if (held) return held;
    if (failedTrips.get(tripId)) return NO_STOP_IDS;

    try {
        const res = await golemioClient.fetch(`/v2/gtfs/trips/${tripId}`, env, {
            cacheTtl: UPSTREAM_TTL_S.SCHEDULE_DATA,
            cf: { cacheTtl: UPSTREAM_TTL_S.SCHEDULE_DATA },
            searchParams: { includeStopTimes: 'true' }
        });
        if (!res.ok) {
            failedTrips.set(tripId, true);
            return NO_STOP_IDS;
        }
        const parsed = tripStopTimesSchema.safeParse(await res.json());
        if (!parsed.success) {
            console.error(`Golemio GTFS trip stop times changed shape for ${tripId}`);
            failedTrips.set(tripId, true);
            return NO_STOP_IDS;
        }
        const ids = new Map(parsed.data.stop_times.map((st) => [st.stop_sequence, st.stop_id]));
        stopIdsByTrip.set(tripId, ids);
        return ids;
    } catch (err) {
        console.warn(`Golemio GTFS trip stop times unavailable for ${tripId}:`, err);
        failedTrips.set(tripId, true);
        return NO_STOP_IDS;
    }
}
