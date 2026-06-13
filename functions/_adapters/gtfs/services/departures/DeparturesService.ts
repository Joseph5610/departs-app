import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppDepartureResponse, AppVehicleCollection } from "../../../../_core/types";
import type { CityConfig } from '../../../../_core/city-config';
import { getGtfsData } from '../../core/gtfs-data';
import { DeparturesMapper } from './DeparturesMapper';
import type { GtfsDepartureTuple } from './types';

export class DeparturesService {
    constructor(private city: CityConfig) {}

    async getDepartures(ctx: EventContext<Env, string, unknown>): Promise<AppDepartureResponse> {
        const url = new URL(ctx.request.url);
        const stopId = url.searchParams.get('stopId');
        
        if (!stopId) {
            return { departures: [] };
        }

        try {
            const staticDataUrl = this.city.adapterConfig?.staticDataUrl;
            if (!staticDataUrl) throw new Error('Missing staticDataUrl in city config');

            const chunkId = encodeURIComponent(stopId.substring(0, 3).toUpperCase());
            const dataUrl = `${staticDataUrl}/${this.city.slug}/departures/${chunkId}.json`;
            
            const res = await fetch(dataUrl);
            if (!res.ok) {
                return { departures: [] };
            }
            
            const chunkData = await res.json() as Record<string, GtfsDepartureTuple[]>;
            const deps = chunkData[stopId];
            if (!deps) {
                return { departures: [] };
            }

            const { routes } = await getGtfsData(this.city.slug);
            const rtVehicles = await this.getRealtimeVehiclesCache();
            
            const mapped = DeparturesMapper.mapDepartures(deps, routes, rtVehicles);
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
