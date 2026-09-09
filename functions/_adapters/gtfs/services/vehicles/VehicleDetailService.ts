import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppVehicleDetail } from "../../../../_core/types";
import type { CityConfig } from '../../../../_core/city-config';
import { getGtfsRoutes, getGtfsTripRoutes } from '../../core/gtfs-data';
import { appClient } from '../../../../_core/ApiClient';
import { CacheManager, CACHE_TTL } from '../../../../_core/utils/CacheManager';
import { LruCache } from '../../../../_core/utils/LruCache';
import { shapeChunkId } from '../../core/config';
import { VehicleDetailMapper } from './VehicleDetailMapper';
import type { Station } from './types';
import { vehicleDetailQuerySchema, parseSearchParams } from '../../../../_core/schemas';
import { ApiError } from '../../../../_core/errors';
import { ERROR_MESSAGES } from '../../../../_core/api-utils';
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
 * Static timetable stops, keyed by `${citySlug}:${tripId}`.
 *
 * Like the geometry above, this is static per trip but sits on the polled detail endpoint, so
 * without a memo every poll re-fetched and re-parsed the whole trips chunk.
 */
const tripStopsCache = new LruCache<Station[]>({
    maxEntries: 512,
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

        const t0 = Date.now();
        const [stations, { routes }, { tripRoutes }, tripShape] = await Promise.all([
            this.getTripStops(tripId),
            getGtfsRoutes(this.city.slug),
            getGtfsTripRoutes(this.city.slug),
            this.getTripShape(tripId),
        ]);
        const tSources = Date.now();
        
        const routeInfo = tripRoutes[tripId];
        const routeId = routeInfo ? routeInfo.split('|')[0] : undefined;
        const route = routeId ? routes[routeId] : null;

        if (stations.length === 0 && !route) {
            throw new ApiError(ERROR_MESSAGES.VEHICLE_NOT_FOUND, 404);
        }

        let detail = VehicleDetailMapper.mapVehicleDetail(tripId, vehicleId, stations, route, tripShape);
        const tMapped = Date.now();

        if (this.enricher) {
            detail = await this.enricher.enrich(detail, ctx);
        }

        const tEnriched = Date.now();
        console.log(`[PERF] ${this.city.slug} vehicle-detail ${tripId}: sources=${tSources - t0}ms, map=${tMapped - tSources}ms, enrich=${tEnriched - tMapped}ms, total=${tEnriched - t0}ms`);

        return detail;
    }

    private async getTripStops(tripId: string): Promise<Station[]> {
        const chunkId = encodeURIComponent(tripId.substring(0, 3).toUpperCase());
        const staticDataUrl = this.city.adapterConfig?.staticDataUrl;
        if (!staticDataUrl) throw new Error('Missing staticDataUrl in city config');

        const cacheKey = `${this.city.slug}:${tripId}`;
        const cached = tripStopsCache.get(cacheKey);
        if (cached !== undefined) return cached;

        const tripUrl = `${staticDataUrl}/${this.city.slug}/trips/${chunkId}.json`;
        try {
            const tripRes = await appClient.fetch(tripUrl, { cf: { cacheTtl: 86400 } });
            if (!tripRes.ok) return [];

            const raw = await tripRes.text();
            const tParseStart = Date.now();
            const chunkData = JSON.parse(raw) as Record<string, unknown[]>;
            const tripData = chunkData[tripId];
            console.log(`[PERF] ${this.city.slug} trips chunk ${chunkId}: bytes=${raw.length}, parse=${Date.now() - tParseStart}ms, tripId=${tripId}, hit=${tripData != null}`);

            if (!tripData) {
                tripStopsCache.set(cacheKey, []);
                return [];
            }

            const stations = tripData.map((st: unknown, idx: number) => {
                const s = st as Record<string, unknown>;
                return {
                    id: s.stop_id as string,
                    name: (s.name as string) || 'Unknown',
                    sequence: idx + 1,
                    arrival_time: s.arrival_time as string,
                    departure_time: s.departure_time as string,
                    coordinates: [Number(s.lon) || 0, Number(s.lat) || 0] as [number, number],
                    is_wheelchair_accessible: null,
                    zone_id: s.zone_id as string | null,
                    is_request_stop: s.is_request_stop as boolean | undefined
                };
            });

            tripStopsCache.set(cacheKey, stations);
            return stations;
        } catch (e) {
            console.error('Failed to get trip stops:', e);
            return [];
        }
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
     * to parse cheaply. Falls back to the legacy prefix-keyed layout so a Worker deployed ahead of
     * the regenerated data still resolves geometry.
     */
    private async fetchShapeGeometry(staticDataUrl: string, shapeId: string): Promise<[number, number][][] | null> {
        const candidates = [
            { dir: 'shape_chunks', chunkId: shapeChunkId(shapeId) },
            { dir: 'shapes', chunkId: shapeId.substring(0, 2) }
        ];

        for (const { dir, chunkId } of candidates) {
            const url = `${staticDataUrl}/${this.city.slug}/${dir}/${encodeURIComponent(chunkId)}.json`;
            // `cf` is only a hint here: data.departs.app sits in the same zone as the Worker, where
            // edge caching of subrequests is unreliable. The memo above is the cache that matters.
            const res = await appClient.fetch(url, { cf: { cacheTtl: 86400 } });
            if (!res.ok) continue;

            const raw = await res.text();
            const tParseStart = Date.now();
            const chunk = JSON.parse(raw) as Record<string, [number, number][][]>;
            const shape = chunk[shapeId];
            console.log(`[PERF] ${this.city.slug} shape ${dir}/${chunkId}: bytes=${raw.length}, parse=${Date.now() - tParseStart}ms, shapeId=${shapeId}, hit=${shape != null}`);

            if (shape) return shape;
        }

        return null;
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
