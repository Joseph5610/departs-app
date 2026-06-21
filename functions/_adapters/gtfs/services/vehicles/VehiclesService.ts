import type { EventContext } from "@cloudflare/workers-types";
import { transit_realtime } from "gtfs-realtime-bindings";
import type { Env, AppVehicleCollection } from "../../../../_core/types";
import type { CityConfig } from '../../../../_core/city-config';
import { getGtfsData } from '../../core/gtfs-data';
import { VehiclesMapper } from './VehiclesMapper';
import { vehicleQuerySchema, parseSearchParams } from '../../../../_core/schemas';

import { CacheManager, CACHE_TTL } from '../../../../_core/utils/CacheManager';

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
            
            const { bounds: boundsStr, routeType: rawRouteTypes, routeShortName: routeShortNames } = parseSearchParams(url.searchParams, vehicleQuerySchema);
            const routeTypes = rawRouteTypes.flatMap((t: string) => gtfsTypeMap[t.toLowerCase()] || []);

            let bounds: { minLat: number, minLng: number, maxLat: number, maxLng: number } | null = null;
            if (boundsStr) {
                const parts = boundsStr.split(',').map(Number);
                if (parts.length === 4 && !parts.some(isNaN)) {
                    bounds = {
                        minLat: parts[0],
                        minLng: parts[1],
                        maxLat: parts[2],
                        maxLng: parts[3]
                    };
                }
            }

            const filterCollection = (collection: AppVehicleCollection): AppVehicleCollection => {
                if (rawRouteTypes.length === 0 && routeShortNames.length === 0 && !bounds) return collection;
                
                return {
                    type: 'FeatureCollection',
                    features: collection.features.filter(f => {
                        const typeMatch = rawRouteTypes.length === 0 || routeTypes.includes(f.properties.route_type);
                        const nameMatch = routeShortNames.length === 0 || routeShortNames.includes(f.properties.route_short_name);
                        
                        let boundsMatch = true;
                        if (bounds) {
                            const [lng, lat] = f.geometry.coordinates;
                            boundsMatch = lat >= bounds.minLat && lat <= bounds.maxLat &&
                                          lng >= bounds.minLng && lng <= bounds.maxLng;
                        }
                        
                        return typeMatch && nameMatch && boundsMatch;
                    })
                };
            };

            const cacheKey = `vehicles_${this.city.slug}`;
            
            const result = await CacheManager.getOrFetch(cacheKey, CACHE_TTL.TEN_SECONDS_MS, async () => {
                const cache = caches.default;
                const jsonCacheKey = new Request(`https://departs.app/cache/${this.city.slug}/vehicles_v1`, { method: 'GET' });
                
                // 1. Check native Cloudflare cache
                const cached = await cache.match(jsonCacheKey);
                if (cached) {
                    return await cached.json() as AppVehicleCollection;
                }

                // 2. Fetch origin
                const rtUrl = this.city.adapterConfig?.realtimeUrl;
                if (!rtUrl) {
                    console.warn(`[GTFS Vehicles] No realtimeUrl configured for city: ${this.city.slug}`);
                    return { type: 'FeatureCollection' as const, features: [] } as AppVehicleCollection;
                }

                const response = await fetch(rtUrl, {
                    headers: { 'User-Agent': 'departs-app/1.0' }
                });

                if (!response || !response.ok) {
                    return { type: 'FeatureCollection' as const, features: [] } as AppVehicleCollection;
                }

                const buffer = await response.arrayBuffer();
                const feed = transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

                const { routes, tripRoutes } = await getGtfsData(this.city.slug);

                const features = VehiclesMapper.mapVehicles(feed, routes, tripRoutes);
                
                const mappedResult: AppVehicleCollection = { type: 'FeatureCollection', features };

                const responseToCache = new Response(JSON.stringify(mappedResult), {
                    headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=10' }
                });
                ctx.waitUntil(cache.put(jsonCacheKey, responseToCache));

                return mappedResult;
            });

            return filterCollection(result);

        } catch (e) {
            console.error('Error fetching/parsing GTFS-RT:', e);
            return { type: 'FeatureCollection' as const, features: [] } as AppVehicleCollection;
        }
    }
}
