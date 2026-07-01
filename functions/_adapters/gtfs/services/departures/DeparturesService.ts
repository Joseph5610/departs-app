import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppDepartureResponse, AppVehicleCollection } from "../../../../_core/types";
import type { CityConfig } from '../../../../_core/city-config';
import { getGtfsData } from '../../core/gtfs-data';
import { gtfsFetch } from '../../core/utils';
import { DeparturesMapper } from './DeparturesMapper';
import type { GtfsDepartureTuple } from './types';
import { departuresQuerySchema, parseSearchParams } from '../../../../_core/schemas';
import { CacheManager, CACHE_TTL } from '../../../../_core/utils/CacheManager';

export class DeparturesService {
    constructor(private city: CityConfig) {}

    async getDepartures(ctx: EventContext<Env, string, unknown>): Promise<AppDepartureResponse> {
        const url = new URL(ctx.request.url);
        const { stopId: stopIds } = parseSearchParams(url.searchParams, departuresQuerySchema);
        
        if (!stopIds || stopIds.length === 0) {
            return { departures: [] };
        }

        try {
            const staticDataUrl = this.city.adapterConfig?.staticDataUrl;
            if (!staticDataUrl) throw new Error('Missing staticDataUrl in city config');

            const parentToChildMap = await CacheManager.getOrFetch<Record<string, string[]>>(
                `parent_child_map_${this.city.slug}`,
                CACHE_TTL.TWO_HOURS_MS,
                async () => {
                    const res = await gtfsFetch(`${staticDataUrl}/${this.city.slug}/parent_child_map.json`);
                    if (!res.ok) return {};
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
                    const res = await gtfsFetch(dataUrl);
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
            const rtVehicles = await this.getRealtimeVehiclesCache();
            
            const mapped = DeparturesMapper.mapDepartures(allDeps, routes, rtVehicles);
            return { departures: mapped };
        } catch (e) {
            console.error('Error loading static departures:', e);
            return { departures: [] };
        }
    }

    private async getRealtimeVehiclesCache(): Promise<AppVehicleCollection | null> {
        try {
            const cache = caches.default;
            const jsonCacheKey = new Request(`https://departs.app/cache/${this.city.slug}/vehicles_v1`, { method: 'GET' });
            const cachedVehicles = await cache.match(jsonCacheKey);
            if (cachedVehicles) {
                return await cachedVehicles.json();
            }
        } catch (e) {
            console.error('Failed to load RT vehicles for departures:', e);
        }
        return null;
    }
}
