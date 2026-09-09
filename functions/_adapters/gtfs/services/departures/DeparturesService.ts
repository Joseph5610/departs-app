import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppDepartureResponse, AppVehicleCollection } from "../../../../_core/types";
import type { CityConfig } from '../../../../_core/city-config';
import { getGtfsRoutes } from '../../core/gtfs-data';
import { appClient } from '../../../../_core/ApiClient';
import { DeparturesMapper } from './DeparturesMapper';
import type { GtfsDepartureTuple } from './types';
import { ApiError } from '../../../../_core/errors';
import { ERROR_MESSAGES } from '../../../../_core/api-utils';
import { departuresQuerySchema, parseSearchParams } from '../../../../_core/schemas';
import { CacheManager, CACHE_TTL } from '../../../../_core/utils/CacheManager';
import { LruCache } from '../../../../_core/utils/LruCache';
import type { VehiclesService } from '../vehicles/VehiclesService';

/**
 * Static departure tuples, keyed by `${citySlug}:${stopId}`.
 *
 * The tuples carry absolute timestamps and are regenerated daily, so they are static within a
 * request window; only the realtime overlay in DeparturesMapper is time-sensitive. Memoising them
 * keeps the 10s departure poll from re-parsing a whole departures chunk (up to ~1.2MB) each time.
 */
const departureTuplesCache = new LruCache<GtfsDepartureTuple[]>({
    maxEntries: 512,
    ttlMs: CACHE_TTL.TWO_HOURS_MS
});

/**
 * Service to fetch and map GTFS static departures for a specific city.
 * Clean modular design with strict separation of validation, resolution, and chunk fetching.
 */
export class DeparturesService {
    constructor(
        public readonly city: CityConfig,
        protected vehiclesService?: VehiclesService
    ) {}

    async getDepartures(ctx: EventContext<Env, string, unknown>): Promise<AppDepartureResponse> {
        const url = new URL(ctx.request.url);
        const { stopId: stopIds } = parseSearchParams(url.searchParams, departuresQuerySchema);
        
        if (!stopIds || stopIds.length === 0) {
            throw new ApiError(ERROR_MESSAGES.MISSING_PARAMS, 400);
        }

        const staticDataUrl = this.city.adapterConfig?.staticDataUrl;
        if (!staticDataUrl) throw new ApiError(ERROR_MESSAGES.STOPS_DATA_UNAVAILABLE, 502);

        try {
            const t0 = Date.now();
            const parentToChildMap = await this.getParentChildMap(staticDataUrl);
            const t1 = Date.now();
            const { targetIds, childToRequestedMap } = this.resolveTargetStopIds(stopIds, parentToChildMap);
            const t2 = Date.now();
            const allDeps = await this.fetchDepartureTuples(targetIds, childToRequestedMap, staticDataUrl);
            const t3 = Date.now();

            if (allDeps.length === 0) {
                return { departures: [] };
            }

            const { routes } = await getGtfsRoutes(this.city.slug);
            const t4 = Date.now();
            const rtVehicles = await this.getRealtimeVehiclesCache();
            const t5 = Date.now();
            
            const result = DeparturesMapper.mapDepartures(allDeps, routes, rtVehicles);
            const t6 = Date.now();

            console.log(`[PERF] Departures ${stopIds.join(',')}: parentMap=${t1-t0}ms, resolve=${t2-t1}ms, fetchTuples=${t3-t2}ms, gtfsData=${t4-t3}ms, rtVehicles=${t5-t4}ms, mapDeps=${t6-t5}ms, total=${t6-t0}ms`);
            return { departures: result };
        } catch (e) {
            if (e instanceof ApiError) throw e;
            console.error('Error loading static departures:', e);
            throw new ApiError(ERROR_MESSAGES.STOPS_DATA_UNAVAILABLE, 502);
        }
    }

    private async getParentChildMap(staticDataUrl: string): Promise<Record<string, string[]>> {
        return CacheManager.getOrFetch(
            `parent_child_map_${this.city.slug}`,
            CACHE_TTL.TWO_HOURS_MS,
            async () => {
                const res = await appClient.fetch(`${staticDataUrl}/${this.city.slug}/parent_child_map.json`);
                if (!res.ok) throw new ApiError(ERROR_MESSAGES.STOPS_DATA_UNAVAILABLE, 502);
                return await res.json() as Record<string, string[]>;
            }
        );
    }



    private resolveTargetStopIds(stopIds: string[], parentToChildMap: Record<string, string[]>) {
        const targetIds: string[] = [];
        const childToRequestedMap = new Map<string, string>();

        for (const rawId of stopIds) {
            const children = parentToChildMap[rawId];

            if (children && children.length > 0) {
                targetIds.push(...children);
                children.forEach(c => childToRequestedMap.set(c, rawId));
            } else {
                targetIds.push(rawId);
                childToRequestedMap.set(rawId, rawId);
            }
        }

        return { targetIds, childToRequestedMap };
    }

    private async fetchDepartureTuples(
        targetIds: string[],
        childToRequestedMap: Map<string, string>,
        staticDataUrl: string
    ): Promise<{ stopId: string; tuple: GtfsDepartureTuple }[]> {
        const allDeps: { stopId: string; tuple: GtfsDepartureTuple }[] = [];
        const collect = (id: string, tuples: GtfsDepartureTuple[]) => {
            const requestedStopId = childToRequestedMap.get(id) || id;
            for (const tuple of tuples) {
                allDeps.push({ stopId: requestedStopId, tuple });
            }
        };

        // Serve what we already hold and only fetch chunks for the stops we are missing.
        const missing: string[] = [];
        for (const id of targetIds) {
            const cached = departureTuplesCache.get(`${this.city.slug}:${id}`);
            if (cached !== undefined) {
                collect(id, cached);
            } else {
                missing.push(id);
            }
        }

        if (missing.length === 0) return allDeps;

        const chunkMap = new Map<string, string[]>();
        for (const id of missing) {
            const chunkId = encodeURIComponent(id.substring(0, 4).toUpperCase());
            if (!chunkMap.has(chunkId)) chunkMap.set(chunkId, []);
            chunkMap.get(chunkId)!.push(id);
        }

        const fetchPromises = Array.from(chunkMap.entries()).map(async ([chunkId, ids]) => {
            const dataUrl = `${staticDataUrl}/${this.city.slug}/departures/${chunkId}.json`;
            try {
                const res = await appClient.fetch(dataUrl, { cf: { cacheTtl: 3600 } });
                if (!res.ok) return;

                const raw = await res.text();
                const tParseStart = Date.now();
                const chunkData = JSON.parse(raw) as Record<string, GtfsDepartureTuple[]>;
                console.log(`[PERF] ${this.city.slug} departures chunk ${chunkId}: bytes=${raw.length}, parse=${Date.now() - tParseStart}ms, stops=${ids.length}`);

                for (const id of ids) {
                    const tuples = chunkData[id] ?? [];
                    departureTuplesCache.set(`${this.city.slug}:${id}`, tuples);
                    collect(id, tuples);
                }
            } catch {
                // Fail silently for missing chunk file
            }
        });

        await Promise.all(fetchPromises);
        return allDeps;
    }

    private async getRealtimeVehiclesCache(): Promise<AppVehicleCollection | null> {
        try {
            if (this.vehiclesService) {
                return await this.vehiclesService.getCachedMappedVehicles();
            }
        } catch (e) {
            console.error('Failed to load RT vehicles for departures via service:', e);
        }
        return null;
    }
}
