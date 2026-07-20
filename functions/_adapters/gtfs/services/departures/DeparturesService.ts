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

export class DeparturesService {
    /**
     * Service to fetch and map GTFS static departures for a specific city.
     * Optionally accepts a VehiclesService to fetch the live vehicle data, enabling
     * real-time delays and enriched metadata (like air conditioning) on the departure board.
     */
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

        try {
            const staticDataUrl = this.city.adapterConfig?.staticDataUrl;
            if (!staticDataUrl) throw new Error('Missing staticDataUrl in city config');

            const parentToChildMap = await CacheManager.getOrFetch<Record<string, string[]>>(
                `parent_child_map_${this.city.slug}`,
                CACHE_TTL.TWO_HOURS_MS,
                async () => {
                    const res = await appClient.fetch(`${staticDataUrl}/${this.city.slug}/parent_child_map.json`);
                    if (!res.ok) throw new ApiError(ERROR_MESSAGES.STOPS_DATA_UNAVAILABLE, 502);
                    return await res.json() as Record<string, string[]>;
                }
            );

            const targetIds: string[] = [];
            const childToRequestedMap = new Map<string, string>();
            
            for (const stopId of stopIds) {
                const children = parentToChildMap[stopId];
                if (children && children.length > 0) {
                    targetIds.push(...children);
                    children.forEach(childId => childToRequestedMap.set(childId, stopId));
                } else {
                    targetIds.push(stopId);
                    childToRequestedMap.set(stopId, stopId);
                }
            }

            const chunkMap = new Map<string, string[]>();
            for (const id of targetIds) {
                const chunkId = encodeURIComponent(id.substring(0, 4).toUpperCase());
                if (!chunkMap.has(chunkId)) chunkMap.set(chunkId, []);
                chunkMap.get(chunkId)!.push(id);
            }

            const allDeps: { stopId: string, tuple: GtfsDepartureTuple }[] = [];

            const fetchPromises = Array.from(chunkMap.entries()).map(async ([chunkId, ids]) => {
                const dataUrl = `${staticDataUrl}/${this.city.slug}/departures/${chunkId}.json`;
                try {
                    const res = await appClient.fetch(dataUrl);
                    const chunkData = await res.json() as Record<string, GtfsDepartureTuple[]>;
                    for (const id of ids) {
                        if (chunkData[id]) {
                            const requestedStopId = childToRequestedMap.get(id) || id;
                            chunkData[id].forEach(tuple => {
                                allDeps.push({ stopId: requestedStopId, tuple });
                            });
                        }
                    }
                } catch {
                    // Fail silently for this chunk, it just means no departures for it or 404
                }
            });

            await Promise.all(fetchPromises);

            if (allDeps.length === 0) {
                return { departures: [] };
            }

            const { routes } = await getGtfsData(this.city.slug);
            const rtVehicles = await this.getRealtimeVehiclesCache(ctx);
            
            const mapped = DeparturesMapper.mapDepartures(allDeps, routes, rtVehicles);
            return { departures: mapped };
        } catch (e) {
            console.error('Error loading static departures:', e);
            throw new ApiError(ERROR_MESSAGES.STOPS_DATA_UNAVAILABLE, 502);
        }
    }

    /**
     * Attempts to resolve real-time vehicle data by invoking the injected VehiclesService.
     * By using the service directly, it leverages the internal memory cache (CacheManager)
     * avoiding duplicate remote fetches and bypassing brittle hardcoded edge cache keys.
     */
    private async getRealtimeVehiclesCache(ctx: EventContext<Env, string, unknown>): Promise<AppVehicleCollection | null> {
        try {
            if (this.vehiclesService) {
                return await this.vehiclesService.getFilteredVehicles(ctx);
            }
        } catch (e) {
            console.error('Failed to load RT vehicles for departures via service:', e);
        }
        return null;
    }
}
