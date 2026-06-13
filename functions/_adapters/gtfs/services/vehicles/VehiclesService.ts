import type { EventContext } from "@cloudflare/workers-types";
import { transit_realtime } from "gtfs-realtime-bindings";
import type { Env, AppVehicleCollection } from "../../../../_core/types";
import type { CityConfig } from '../../../../_core/city-config';
import { getGtfsData } from '../../core/gtfs-data';
import { VehiclesMapper } from './VehiclesMapper';

export class VehiclesService {
    constructor(private city: CityConfig) {}

    async getVehicles(ctx: EventContext<Env, string, unknown>): Promise<AppVehicleCollection> {
        try {
            const url = new URL(ctx.request.url);
            
            // Map string route types from frontend to GTFS route type integers (including extended types)
            const gtfsTypeMap: Record<string, number[]> = {
                'tram': [0, 900],
                'metro': [1, 400],
                'train': [2, 100],
                'bus': [3, 700],
                'ferry': [4, 1000, 1200],
                'funicular': [7, 1400],
                'trolleybus': [11, 800]
            };
            
            const rawRouteTypes = url.searchParams.getAll('routeType');
            const routeTypes = rawRouteTypes.flatMap(t => gtfsTypeMap[t.toLowerCase()] || []);
            
            const routeShortNames = url.searchParams.getAll('routeShortName');

            const filterCollection = (collection: AppVehicleCollection): AppVehicleCollection => {
                if (rawRouteTypes.length === 0 && routeShortNames.length === 0) return collection;
                
                return {
                    type: 'FeatureCollection',
                    features: collection.features.filter(f => {
                        const typeMatch = rawRouteTypes.length === 0 || routeTypes.includes(f.properties.route_type);
                        const nameMatch = routeShortNames.length === 0 || routeShortNames.includes(f.properties.route_short_name);
                        return typeMatch && nameMatch;
                    })
                };
            };

            const cache = caches.default;
            const jsonCacheKey = new Request(`https://departs.app/cache/${this.city.slug}/vehicles_v1`, { method: 'GET' });
            const cached = await cache.match(jsonCacheKey);
            if (cached) {
                const data = await cached.json() as AppVehicleCollection;
                return filterCollection(data);
            }

            const rtUrl = this.city.adapterConfig?.realtimeUrl;
            if (!rtUrl) {
                console.warn(`[GTFS Vehicles] No realtimeUrl configured for city: ${this.city.slug}`);
                return { type: 'FeatureCollection', features: [] };
            }

            const response = await fetch(rtUrl, {
                headers: { 'User-Agent': 'departs-app/1.0' }
            });

            if (!response || !response.ok) {
                return { type: 'FeatureCollection', features: [] };
            }

            const buffer = await response.arrayBuffer();
            const feed = transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

            const { routes, tripRoutes } = await getGtfsData(this.city.slug);

            const features = VehiclesMapper.mapVehicles(feed, routes, tripRoutes);
            
            const result: AppVehicleCollection = { type: 'FeatureCollection', features };

            const responseToCache = new Response(JSON.stringify(result), {
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=10' }
            });
            ctx.waitUntil(cache.put(jsonCacheKey, responseToCache));

            return filterCollection(result);
        } catch (e) {
            console.error('Error fetching/parsing GTFS-RT:', e);
            return { type: 'FeatureCollection', features: [] };
        }
    }
}
