import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppDepartureResponse, AppVehicleCollection } from "../../../../_core/types";
import type { CityConfig } from '../../../../_core/city-config';
import { getGtfsData } from '../../core/gtfs-data';
import { appClient } from '../../../../_core/ApiClient';
import { DeparturesMapper } from './DeparturesMapper';
import type { GtfsDepartureTuple } from './types';
import { ApiError } from '../../../../_core/errors';
import { ERROR_MESSAGES } from '../../../../_core/api-utils';
import { departuresQuerySchema, parseSearchParams } from '../../../../_core/schemas';
import { CacheManager, CACHE_TTL } from '../../../../_core/utils/CacheManager';
import type { VehiclesService } from '../vehicles/VehiclesService';

/**
 * Service to fetch and map GTFS static departures for a specific city.
 * Clean modular design with strict separation of validation, resolution, and chunk fetching.
 */
export class DeparturesService {
    constructor(
        protected city: CityConfig,
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
            const allValidStopIds = await this.getAllValidStopIds(parentToChildMap);

            const hasValidStop = stopIds.some(id => {
                const clean = id.replace(/^centroid-/, '');
                return allValidStopIds.has(id) || allValidStopIds.has(clean);
            });

            if (!hasValidStop) {
                throw new ApiError(ERROR_MESSAGES.INVALID_STOP_ID, 404);
            }

            const { targetIds, childToRequestedMap } = this.resolveTargetStopIds(stopIds, parentToChildMap);
            const allDeps = await this.fetchDepartureTuples(targetIds, childToRequestedMap, staticDataUrl);

            if (allDeps.length === 0) {
                return { departures: [] };
            }

            const { routes } = await getGtfsData(this.city.slug);
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

    private async getAllValidStopIds(parentToChildMap: Record<string, string[]>): Promise<Set<string>> {
        return CacheManager.getOrFetch(
            `valid_stops_set_${this.city.slug}`,
            CACHE_TTL.TWO_HOURS_MS,
            async () => {
                return new Set([
                    ...Object.keys(parentToChildMap),
                    ...Object.values(parentToChildMap).flat()
                ]);
            }
        );
    }

    private resolveTargetStopIds(stopIds: string[], parentToChildMap: Record<string, string[]>) {
        const targetIds: string[] = [];
        const childToRequestedMap = new Map<string, string>();

        for (const rawId of stopIds) {
            const cleanId = rawId.replace(/^centroid-/, '');
            const children = parentToChildMap[rawId] || parentToChildMap[cleanId];

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
        const chunkMap = new Map<string, string[]>();
        for (const id of targetIds) {
            const chunkId = encodeURIComponent(id.substring(0, 4).toUpperCase());
            if (!chunkMap.has(chunkId)) chunkMap.set(chunkId, []);
            chunkMap.get(chunkId)!.push(id);
        }

        const allDeps: { stopId: string; tuple: GtfsDepartureTuple }[] = [];

        const fetchPromises = Array.from(chunkMap.entries()).map(async ([chunkId, ids]) => {
            const dataUrl = `${staticDataUrl}/${this.city.slug}/departures/${chunkId}.json`;
            try {
                const res = await appClient.fetch(dataUrl);
                if (res.ok) {
                    const chunkData = await res.json() as Record<string, GtfsDepartureTuple[]>;
                    for (const id of ids) {
                        if (chunkData[id]) {
                            const requestedStopId = childToRequestedMap.get(id) || id;
                            chunkData[id].forEach(tuple => allDeps.push({ stopId: requestedStopId, tuple }));
                        }
                    }
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
