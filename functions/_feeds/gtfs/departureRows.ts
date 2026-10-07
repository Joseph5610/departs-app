import type { CityConfig } from '../../_core/cityConfig';
import { appClient } from '../../_core/ApiClient';
import { ERROR_MESSAGES, UPSTREAM_TTL_S, STATIC_DATA_CONFIG } from '../../_core/config';
import { ApiError } from '../../_core/errors';
import { MEMORY_CACHE_TTL, getOrFetch } from '../../_core/feed/cacheManager';
import { LruCache } from '../../_core/feed/LruCache';
import { departuresBucketId, GTFS_CONFIG, stopIndexShardId } from './config';
import type { GtfsDepartureTuple } from './types';

/**
 * Departure rows by `${citySlug}:${stopId}`.
 *
 * The rows carry absolute timestamps and are rebuilt daily, so they are static within a request
 * window; only the realtime overlay is time-sensitive. Holding them keeps the 10s departure poll
 * from re-parsing a whole bucket (~100KB) every time.
 */
const rowsByStop = new LruCache<GtfsDepartureTuple[]>({
    maxEntries: GTFS_CONFIG.DEPARTURE_ROWS_CACHE_MAX_ENTRIES,
    ttlMs: MEMORY_CACHE_TTL.TWO_HOURS_MS
});

/** `[station]` for a platform, `[null, ...platforms]` for a station (`stop_index/`). */
export type StopRelation = [string] | [null, ...string[]];

/** Parsed `stop_index/` shards by `${citySlug}:${shardId}`. */
const stopShards = new LruCache<Record<string, StopRelation>>({
    maxEntries: GTFS_CONFIG.STOP_INDEX_CACHE_MAX_ENTRIES,
    ttlMs: MEMORY_CACHE_TTL.TWO_HOURS_MS
});

/** Which platforms each station has, network-wide; read only when a request names stops across many shards. */
function getParentChildMap(city: CityConfig): Promise<Record<string, string[]>> {
    return getOrFetch(
        `parent_child_map_${city.slug}`,
        MEMORY_CACHE_TTL.TWO_HOURS_MS,
        async () => {
            const res = await appClient.fetch(`${STATIC_DATA_CONFIG.BASE_URL}/${city.slug}/parent_child_map.json`, { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA });
            if (!res.ok) throw new ApiError(ERROR_MESSAGES.STOPS_DATA_UNAVAILABLE, 502);
            return await res.json() as Record<string, string[]>;
        }
    );
}

async function getStopShard(city: CityConfig, shardId: string): Promise<Record<string, StopRelation>> {
    const key = `${city.slug}:${shardId}`;
    const held = stopShards.get(key);
    if (held) return held;
    const res = await appClient.fetch(`${STATIC_DATA_CONFIG.BASE_URL}/${city.slug}/stop_index/${shardId}.json`, { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA });
    if (!res.ok) throw new ApiError(ERROR_MESSAGES.STOPS_DATA_UNAVAILABLE, 502);
    const shard = await res.json() as Record<string, StopRelation>;
    stopShards.set(key, shard);
    return shard;
}

/** Relations of the stops of the whole network map that `stopIds` name. */
function relationsInMap(parentChildMap: Record<string, string[]>, stopIds: string[]): Map<string, StopRelation> {
    const wanted = new Set(stopIds);
    const relations = new Map<string, StopRelation>();
    for (const parent in parentChildMap) {
        const children = parentChildMap[parent];
        if (wanted.has(parent)) relations.set(parent, [null, ...children]);
        for (const child of children) if (wanted.has(child)) relations.set(child, [parent]);
    }
    return relations;
}

/** Each known stop of `stopIds` and its station or platforms; a stop the data does not know is left out. */
export async function getStopRelations(city: CityConfig, stopIds: string[]): Promise<Map<string, StopRelation>> {
    const shardIds = new Set(stopIds.map(stopIndexShardId));
    if (shardIds.size > GTFS_CONFIG.STOP_INDEX_MAX_SHARDS) return relationsInMap(await getParentChildMap(city), stopIds);

    const shards = new Map<string, Record<string, StopRelation>>();
    await Promise.all(Array.from(shardIds, async (shardId) => shards.set(shardId, await getStopShard(city, shardId))));
    const relations = new Map<string, StopRelation>();
    for (const id of stopIds) {
        const relation = shards.get(stopIndexShardId(id))?.[id];
        if (relation) relations.set(id, relation);
    }
    return relations;
}

/**
 * The timetable rows of the given stops, one subrequest per bucket they share and none for stops
 * already held. A stop the data does not know simply has no rows. `parentOf` names the station of
 * each platform among them, whose bucket holds its rows.
 */
export async function getDepartureRows(city: CityConfig, stopIds: string[], parentOf: ReadonlyMap<string, string>): Promise<Map<string, GtfsDepartureTuple[]>> {
    const rows = new Map<string, GtfsDepartureTuple[]>();
    const missing: string[] = [];

    for (const id of stopIds) {
        const held = rowsByStop.get(`${city.slug}:${id}`);
        if (held !== undefined) rows.set(id, held);
        else missing.push(id);
    }
    if (missing.length === 0) return rows;

    const byBucket = new Map<string, string[]>();
    for (const id of missing) {
        const bucketId = departuresBucketId(id, parentOf);
        const ids = byBucket.get(bucketId);
        if (ids) ids.push(id);
        else byBucket.set(bucketId, [id]);
    }

    await Promise.all(Array.from(byBucket, async ([bucketId, ids]) => {
        try {
            const res = await appClient.fetch(`${STATIC_DATA_CONFIG.BASE_URL}/${city.slug}/departure_buckets/${bucketId}.json`, {
                cacheTtl: UPSTREAM_TTL_S.DEPARTURE_BUCKETS,
                cf: { cacheTtl: UPSTREAM_TTL_S.DEPARTURE_BUCKETS }
            });
            if (!res.ok) return;

            const bucket = JSON.parse(await res.text()) as Record<string, GtfsDepartureTuple[]>;
            for (const id of ids) {
                const tuples = bucket[id] ?? [];
                rowsByStop.set(`${city.slug}:${id}`, tuples);
                rows.set(id, tuples);
            }
        } catch (e) {
            console.error(`Failed to load departures bucket ${bucketId} for ${city.slug}:`, e);
        }
    }));

    return rows;
}
