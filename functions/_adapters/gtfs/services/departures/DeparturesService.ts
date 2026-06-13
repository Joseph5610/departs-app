import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppDepartureResponse, AppVehicleCollection } from "../../../../_core/types";
import type { CityConfig } from '../../../../_core/city-config';
import { getGtfsData } from '../../core/gtfs-data';
import { DeparturesMapper } from './DeparturesMapper';
import type { GtfsDepartureTuple } from './types';
import { StopsService } from '../stops/StopsService';

export class DeparturesService {
    constructor(private city: CityConfig) {}

    async getDepartures(ctx: EventContext<Env, string, unknown>): Promise<AppDepartureResponse> {
        const url = new URL(ctx.request.url);
        const stopIds = url.searchParams.getAll('stopId');
        
        if (!stopIds || stopIds.length === 0) {
            return { departures: [] };
        }

        try {
            const staticDataUrl = this.city.adapterConfig?.staticDataUrl;
            if (!staticDataUrl) throw new Error('Missing staticDataUrl in city config');

            const targetIds: string[] = [];
            
            for (const stopId of stopIds) {
                if (stopId.startsWith('centroid-')) {
                    try {
                        const stopsService = new StopsService(this.city);
                        const stopsColl = await stopsService.getStops();
                        const centroid = stopsColl.features.find(f => f.properties.stop_id === stopId);
                        if (centroid && centroid.properties.all_ids && centroid.properties.all_ids.length > 0) {
                            targetIds.push(...centroid.properties.all_ids);
                        } else {
                            targetIds.push(stopId);
                        }
                    } catch (e) {
                        console.error('Failed to resolve centroid children:', e);
                        targetIds.push(stopId);
                    }
                } else {
                    targetIds.push(stopId);
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
                            chunkData[id].forEach(tuple => {
                                allDeps.push({ stopId: id, tuple });
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
