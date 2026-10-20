import type { CityConfig } from '../../_core/cityConfig';
import { appClient } from '../../_core/ApiClient';
import { ERROR_MESSAGES, UPSTREAM_TTL_S, STATIC_DATA_CONFIG } from '../../_core/config';
import { ApiError } from '../../_core/errors';
import { MEMORY_CACHE_TTL, getOrFetch } from '../../_core/feed/cacheManager';
import { LruCache } from '../../_core/feed/LruCache';
import { departuresBucketId, GTFS_CONFIG, stopIndexShardId } from './config';
import type { GtfsDepartureTuple } from './types';
import { parseStopRequest } from '../../_core/utils/stopIds';

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

/** `[station]` for a platform, `[null, ...platforms]` for a station. */
export type StopRelation = [string] | [null, ...string[]];

/** The key of a departure bucket's station list (departs-data `BUCKET_STATIONS_KEY`). */
const BUCKET_STATIONS_KEY = '$stations';

const NO_PARENTS: ReadonlyMap<string, string> = new Map();

type DepartureBucket = Record<string, GtfsDepartureTuple[]> & { [BUCKET_STATIONS_KEY]?: Record<string, string[]> };

/** Each station's platforms by `${citySlug}:${stationId}`, read from the buckets' `$stations`; `[]` marks an id that is no station. */
const stationPlatforms = new LruCache<string[]>({
    maxEntries: GTFS_CONFIG.STATION_PLATFORMS_CACHE_MAX_ENTRIES,
    ttlMs: MEMORY_CACHE_TTL.TWO_HOURS_MS
});

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
            const res = await appClient.fetch(`${STATIC_DATA_CONFIG.BASE_URL}/${city.slug}/parent_child_map.json?g=${STATIC_DATA_CONFIG.INDEX_CACHE_GENERATION}`, { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA });
            if (!res.ok) throw new ApiError(ERROR_MESSAGES.STOPS_DATA_UNAVAILABLE, 502);
            return await res.json() as Record<string, string[]>;
        }
    );
}

async function getStopShard(city: CityConfig, shardId: string): Promise<Record<string, StopRelation>> {
    const key = `${city.slug}:${shardId}`;
    const held = stopShards.get(key);
    if (held) return held;
    const res = await appClient.fetch(`${STATIC_DATA_CONFIG.BASE_URL}/${city.slug}/stop_index/${shardId}.json?g=${STATIC_DATA_CONFIG.INDEX_CACHE_GENERATION}`, { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA });
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

/** Relations of `stopIds` from `stop_index/`, for platforms named without their station (older clients). */
async function indexedRelations(city: CityConfig, stopIds: string[]): Promise<Map<string, StopRelation>> {
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

/** A departure bucket, its station lists kept for `getStationPlatforms`; null when it cannot be read. */
async function fetchBucket(city: CityConfig, bucketId: string): Promise<DepartureBucket | null> {
    try {
        const res = await appClient.fetch(`${STATIC_DATA_CONFIG.BASE_URL}/${city.slug}/departure_buckets/${bucketId}.json?g=${STATIC_DATA_CONFIG.INDEX_CACHE_GENERATION}`, {
            cacheTtl: UPSTREAM_TTL_S.DEPARTURE_BUCKETS,
            cf: { cacheTtl: UPSTREAM_TTL_S.DEPARTURE_BUCKETS }
        });
        if (!res.ok) return null;
        const bucket = JSON.parse(await res.text()) as DepartureBucket;
        for (const [station, platforms] of Object.entries(bucket[BUCKET_STATIONS_KEY] ?? {})) stationPlatforms.set(`${city.slug}:${station}`, platforms);
        return bucket;
    } catch (e) {
        console.error(`Failed to load departures bucket ${bucketId} for ${city.slug}:`, e);
        return null;
    }
}

/** The platforms of each of `ids` that is a station, from the departure buckets the stations hash into. */
export async function getStationPlatforms(city: CityConfig, ids: string[]): Promise<Map<string, string[]>> {
    const found = new Map<string, string[]>();
    const missing: string[] = [];
    for (const id of ids) {
        const held = stationPlatforms.get(`${city.slug}:${id}`);
        if (held === undefined) missing.push(id);
        else if (held.length) found.set(id, held);
    }
    const bucketIds = new Set(missing.map(id => departuresBucketId(id, NO_PARENTS)));
    await Promise.all(Array.from(bucketIds, async (bucketId) => {
        const bucket = await fetchBucket(city, bucketId);
        // A bucket with a station list names every station hashed into it, so an id it lacks is no station.
        if (!bucket?.[BUCKET_STATIONS_KEY]) return;
        for (const id of missing) {
            if (departuresBucketId(id, NO_PARENTS) !== bucketId) continue;
            const platforms = bucket[BUCKET_STATIONS_KEY][id];
            if (platforms) found.set(id, platforms);
            else stationPlatforms.set(`${city.slug}:${id}`, []);
        }
    }));
    return found;
}

/**
 * The relations of the stops the requested values name, without any index for a `station:platforms` value or a
 * station: the value names a platform's station, and a station's platforms are listed in its departure bucket.
 * Only a platform named on its own (by older clients) is looked up in `stop_index/`.
 */
export async function getStopRelations(city: CityConfig, values: string[]): Promise<Map<string, StopRelation>> {
    const relations = new Map<string, StopRelation>();
    const stations = new Set<string>();
    const loose: string[] = [];
    for (const value of values) {
        const { station, parts } = parseStopRequest(value);
        if (station) {
            stations.add(station);
            for (const part of parts) if (part !== station) relations.set(part, [station]);
        } else {
            loose.push(...parts);
        }
    }
    const platformsOf = await getStationPlatforms(city, [...stations, ...loose]);
    for (const [station, platforms] of platformsOf) relations.set(station, [null, ...platforms]);

    const unresolved = loose.filter(id => !relations.has(id));
    if (unresolved.length > 0) {
        for (const [id, relation] of await indexedRelations(city, unresolved)) relations.set(id, relation);
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
        const bucket = await fetchBucket(city, bucketId);
        if (!bucket) return;
        for (const id of ids) {
            const tuples = bucket[id] ?? [];
            rowsByStop.set(`${city.slug}:${id}`, tuples);
            rows.set(id, tuples);
        }
    }));

    return rows;
}
