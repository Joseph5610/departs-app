import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppDepartureResponse, AppVehicleCollection } from "../../../../_core/types";
import type { CityConfig } from '../../../../_core/city-config';
import { getGtfsRoutes } from '../../core/gtfs-data';
import { appClient } from '../../../../_core/ApiClient';
import { DeparturesMapper } from './DeparturesMapper';
import type { GtfsDepartureTuple } from './types';
import { ApiError } from '../../../../_core/errors';
import { ERROR_MESSAGES } from '../../../../_core/config';
import { departuresQuerySchema, parseSearchParams } from '../../../../_core/schemas';
import { GTFS_CONFIG, departuresChunkId } from '../../core/config';
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
            const parentToChildMap = await this.getParentChildMap(staticDataUrl);
            const { targetIds, childToRequestedMap } = this.resolveTargetStopIds(stopIds, parentToChildMap);
            const allDeps = await this.fetchDepartureTuples(targetIds, childToRequestedMap, staticDataUrl);

            if (allDeps.length === 0) {
                return { departures: [] };
            }

            const { routes } = await getGtfsRoutes(this.city.slug);
            const rtVehicles = await this.getRealtimeVehiclesCache();

            return { departures: DeparturesMapper.mapDepartures(allDeps, routes, rtVehicles) };
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



    /**
     * Expands each requested id into the platforms departures are actually attached to.
     *
     * The request-level cap in `departuresQuerySchema` bounds how many ids may be *named*; this bounds
     * how many they may *expand into*, which is what actually drives subrequest count. A handful of
     * large interchange stations can otherwise produce hundreds of targets from a request that passed
     * the first check.
     */
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

            if (targetIds.length > GTFS_CONFIG.MAX_DEPARTURE_TARGET_STOPS) {
                throw new ApiError(
                    `Too many stops requested; this expands to more than ${GTFS_CONFIG.MAX_DEPARTURE_TARGET_STOPS} platforms.`,
                    400
                );
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
            const chunkId = encodeURIComponent(departuresChunkId(id));
            if (!chunkMap.has(chunkId)) chunkMap.set(chunkId, []);
            chunkMap.get(chunkId)!.push(id);
        }

        const fetchPromises = Array.from(chunkMap.entries()).map(async ([chunkId, ids]) => {
            const dataUrl = `${staticDataUrl}/${this.city.slug}/departures/${chunkId}.json`;
            try {
                const res = await appClient.fetch(dataUrl, { cf: { cacheTtl: 3600 } });
                if (!res.ok) return;

                const chunkData = JSON.parse(await res.text()) as Record<string, GtfsDepartureTuple[]>;

                for (const id of ids) {
                    const tuples = chunkData[id] ?? [];
                    departureTuplesCache.set(`${this.city.slug}:${id}`, tuples);
                    collect(id, tuples);
                }
            } catch (e) {
                console.error(`Failed to load departures chunk ${chunkId} for ${this.city.slug}:`, e);
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
