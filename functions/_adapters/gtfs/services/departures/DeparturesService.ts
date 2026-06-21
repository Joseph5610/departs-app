import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppDepartureResponse, AppVehicleCollection } from "../../../../_core/types";
import type { CityConfig } from '../../../../_core/city-config';
import { getGtfsData } from '../../core/gtfs-data';
import { DeparturesMapper } from './DeparturesMapper';
import type { GtfsDepartureTuple } from './types';
import { StopsService } from '../stops/StopsService';
import { departuresQuerySchema, parseSearchParams } from '../../../../_core/schemas';

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

            const targetIds: string[] = [];
            const childToRequestedMap = new Map<string, string>();
            
            for (const stopId of stopIds) {
                // If they ask for a parent station, resolve to all its child nodes
                try {
                    const stopsService = new StopsService(this.city);
                    const stopsColl = await stopsService.getStops();
                    const parent = stopsColl.features.find(f => f.properties.stop_id === stopId);
                    
                    if (parent && parent.properties.all_ids && parent.properties.all_ids.length > 0) {
                        targetIds.push(...parent.properties.all_ids);
                        parent.properties.all_ids.forEach(childId => childToRequestedMap.set(childId, stopId));
                    } else {
                        targetIds.push(stopId);
                        childToRequestedMap.set(stopId, stopId);
                    }
                } catch (e) {
                    console.error('Failed to resolve children:', e);
                    targetIds.push(stopId);
                    childToRequestedMap.set(stopId, stopId);
                }
            }

            const chunkMap = new Map<string, string[]>();
            for (const id of targetIds) {
                const chunkId = encodeURIComponent(id.substring(0, 3).toUpperCase());
                if (!chunkMap.has(chunkId)) chunkMap.set(chunkId, []);
                chunkMap.get(chunkId)!.push(id);
            }

            const allDeps: { stopId: string, tuple: GtfsDepartureTuple }[] = [];

            const fetchPromises = Array.from(chunkMap.entries()).map(async ([chunkId, ids]) => {
                const dataUrl = `${staticDataUrl}/${this.city.slug}/departures/${chunkId}.json`;
                const res = await fetch(dataUrl);
                if (res.ok) {
                    const chunkData = await res.json() as Record<string, GtfsDepartureTuple[]>;
                    for (const id of ids) {
                        if (chunkData[id]) {
                            const requestedStopId = childToRequestedMap.get(id) || id;
                            chunkData[id].forEach(tuple => {
                                allDeps.push({ stopId: requestedStopId, tuple });
                            });
                        }
                    }
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
