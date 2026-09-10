import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppVehicleDetail } from "../../../../_core/types";
import type { CityConfig } from '../../../../_core/city-config';
import { getGtfsRoutes, getGtfsTripRoutes } from '../../core/gtfs-data';
import { appClient } from '../../../../_core/ApiClient';
import { CacheManager, CACHE_TTL } from '../../../../_core/utils/CacheManager';
import { LruCache } from '../../../../_core/utils/LruCache';
import { shapeChunkId } from '../../core/config';
import { getTripStops } from '../../core/trip-stops';
import { VehicleDetailMapper } from './VehicleDetailMapper';
import { vehicleDetailQuerySchema, parseSearchParams } from '../../../../_core/schemas';
import { ApiError } from '../../../../_core/errors';
import { ERROR_MESSAGES } from '../../../../_core/config';
import type { VehicleDetailEnricher } from './VehicleDetailEnricher';

/**
 * Resolved route geometry, keyed by `${citySlug}:${shapeId}`.
 *
 * A trip's shape is static, but the detail endpoint is polled at TRANSIT_REFRESH_MS by every open
 * detail panel, so without this memo every poll re-parsed a whole shape chunk. Bounded so an
 * isolate cannot accumulate the whole network's geometry.
 */
const shapeCache = new LruCache<[number, number][][] | null>({
    maxEntries: 256,
    ttlMs: CACHE_TTL.TWO_HOURS_MS
});

/**
 * The core orchestrator for the /vehicles/:id detail endpoint.
 * It builds the static timetable from the raw GTFS schedule data.
 * If an Enricher is provided, it delegates the live GPS/delay merging to that Enricher.
 */
export class VehicleDetailService {
    constructor(public readonly city: CityConfig, private enricher?: VehicleDetailEnricher) {}

    async getVehicleDetail(ctx: EventContext<Env, string, unknown>): Promise<AppVehicleDetail> {
        const url = new URL(ctx.request.url);
        const { vehicleId: rawVehicleId, tripId } = parseSearchParams(url.searchParams, vehicleDetailQuerySchema);
        const vehicleId = rawVehicleId || null;

        const [stations, { routes }, { tripRoutes }, tripShape] = await Promise.all([
            getTripStops(this.city, tripId),
            getGtfsRoutes(this.city.slug),
            getGtfsTripRoutes(this.city.slug),
            this.getTripShape(tripId),
        ]);

        const routeId = tripRoutes[tripId];
        const route = routeId ? routes[routeId] : null;

        if (stations.length === 0 && !route) {
            throw new ApiError(ERROR_MESSAGES.VEHICLE_NOT_FOUND, 404);
        }

        let detail = VehicleDetailMapper.mapVehicleDetail(tripId, vehicleId, stations, route, tripShape);

        if (this.enricher) {
            detail = await this.enricher.enrich(detail, ctx);
        }

        return detail;
    }

    /**
     * Fetches the precise GTFS shape coordinates for a given trip.
     * Looks up the shape_id from the memoised trip_shapes.json index, then resolves the geometry
     * from the in-isolate shape cache, falling back to fetching and parsing the shape chunk.
     * Returns null if no shape is available (graceful degradation to station-line fallback).
     */
    private async getTripShape(tripId: string): Promise<[number, number][][] | null> {
        const staticDataUrl = this.city.adapterConfig?.staticDataUrl;
        if (!staticDataUrl) return null;

        try {
            const tripShapes = await this.getTripShapeIndex(staticDataUrl);
            const shapeId = tripShapes[tripId];
            if (!shapeId) return null;

            const cacheKey = `${this.city.slug}:${shapeId}`;
            const cached = shapeCache.get(cacheKey);
            if (cached !== undefined) return cached;

            const shape = await this.fetchShapeGeometry(staticDataUrl, shapeId);
            shapeCache.set(cacheKey, shape);
            return shape;
        } catch (e) {
            console.error('Failed to get trip shape:', e);
            return null;
        }
    }

    /**
     * Reads a single shape's geometry out of its chunk.
     *
     * Shapes are bucketed by `shape_id % SHAPE_CHUNK_COUNT`, which keeps each chunk small enough
     * to parse cheaply.
     */
    private async fetchShapeGeometry(staticDataUrl: string, shapeId: string): Promise<[number, number][][] | null> {
        const chunkId = shapeChunkId(shapeId);
        const url = `${staticDataUrl}/${this.city.slug}/shape_chunks/${encodeURIComponent(chunkId)}.json`;

        // `cf` is only a hint here: data.departs.app sits in the same zone as the Worker, where
        // edge caching of subrequests is unreliable. The memo above is the cache that matters.
        const res = await appClient.fetch(url, { cf: { cacheTtl: 86400 } });
        if (!res.ok) return null;

        const chunk = JSON.parse(await res.text()) as Record<string, [number, number][][]>;
        return chunk[shapeId] ?? null;
    }

    /**
     * Fetches the tripId -> shapeId index, memoised in-isolate so it is parsed once per TTL
     * rather than on every detail poll.
     */
    private async getTripShapeIndex(staticDataUrl: string): Promise<Record<string, string>> {
        return CacheManager.getOrFetch(
            `trip_shapes_${this.city.slug}`,
            CACHE_TTL.TWO_HOURS_MS,
            async () => {
                const res = await appClient.fetch(`${staticDataUrl}/${this.city.slug}/trip_shapes.json`, { cf: { cacheTtl: 86400 } });
                if (!res.ok) return {};
                return await res.json() as Record<string, string>;
            },
            (index) => !index || Object.keys(index).length === 0
        );
    }
}
