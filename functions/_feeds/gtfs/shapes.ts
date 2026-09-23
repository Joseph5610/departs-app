import type { CityConfig } from '../../_core/city-config';
import { appClient } from '../../_core/ApiClient';
import { UPSTREAM_TTL_S } from '../../_core/config';
import { CacheManager, MEMORY_CACHE_TTL } from '../../_core/feed/CacheManager';
import { LruCache } from '../../_core/feed/LruCache';
import { shapeChunkId } from './config';

type ShapeGeometry = [number, number][][];

/**
 * Resolved route geometry, keyed by `${citySlug}:${shapeId}`.
 *
 * A trip's shape is static, but the detail endpoint is polled at TRANSIT_REFRESH_MS by every open
 * detail panel, so without this memo every poll re-parsed a whole shape chunk. Bounded so an
 * isolate cannot accumulate the whole network's geometry.
 */
const shapeCache = new LruCache<ShapeGeometry | null>({
    maxEntries: 256,
    ttlMs: MEMORY_CACHE_TTL.TWO_HOURS_MS
});

/**
 * The precise GTFS shape of a trip: its shape_id from the trip_shapes.json index, then the geometry
 * out of that shape's chunk. Null when no shape is available, so the detail falls back to a line
 * through its stations.
 */
export async function getTripShape(city: CityConfig, tripId: string): Promise<ShapeGeometry | null> {
    const staticDataUrl = city.feed?.staticDataUrl;
    if (!staticDataUrl) return null;

    try {
        const tripShapes = await getTripShapeIndex(city, staticDataUrl);
        const shapeId = tripShapes[tripId];
        if (!shapeId) return null;

        const cacheKey = `${city.slug}:${shapeId}`;
        const cached = shapeCache.get(cacheKey);
        if (cached !== undefined) return cached;

        const shape = await fetchShapeGeometry(city, staticDataUrl, shapeId);
        shapeCache.set(cacheKey, shape);
        return shape;
    } catch (e) {
        console.error('Failed to get trip shape:', e);
        return null;
    }
}

/**
 * Reads a single shape's geometry out of its chunk. Shapes are bucketed by
 * `shape_id % SHAPE_CHUNK_COUNT`, which keeps each chunk small enough to parse cheaply.
 */
async function fetchShapeGeometry(city: CityConfig, staticDataUrl: string, shapeId: string): Promise<ShapeGeometry | null> {
    const chunkId = shapeChunkId(shapeId);
    const url = `${staticDataUrl}/${city.slug}/shape_chunks/${encodeURIComponent(chunkId)}.json`;

    // Top-level cacheTtl puts this through ApiClient's explicit caches.default path, not just the `cf`
    // hint: data.departs.app sits in the same zone as the Worker, where that hint alone is unreliable.
    const res = await appClient.fetch(url, { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA, cf: { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA } });
    if (!res.ok) return null;

    const chunk = JSON.parse(await res.text()) as Record<string, ShapeGeometry>;
    return chunk[shapeId] ?? null;
}

/** The tripId -> shapeId index, parsed once per TTL rather than on every detail poll. */
function getTripShapeIndex(city: CityConfig, staticDataUrl: string): Promise<Record<string, string>> {
    return CacheManager.getOrFetch(
        `trip_shapes_${city.slug}`,
        MEMORY_CACHE_TTL.TWO_HOURS_MS,
        async () => {
            const res = await appClient.fetch(`${staticDataUrl}/${city.slug}/trip_shapes.json`, { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA, cf: { cacheTtl: UPSTREAM_TTL_S.STATIC_DATA } });
            if (!res.ok) return {};
            return await res.json() as Record<string, string>;
        },
        (index) => !index || Object.keys(index).length === 0
    );
}
