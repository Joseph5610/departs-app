import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppVehicleCollection, AppVehicleFeature, AppCityStats } from "../../../../_core/types";
import type { CityConfig } from '../../../../_core/city-config';
import { CacheManager, CACHE_TTL } from '../../../../_core/utils/CacheManager';
import { getGtfsData } from '../../core/gtfs-data';
import { aggregateCityStats } from '../../../../_core/utils/statsAggregator';
import { parseSearchParams, vehicleQuerySchema } from '../../../../_core/schemas';
import { getGtfsRtFeed } from '../../core/gtfs-rt-feed';
import { VehiclesMapper } from './VehiclesMapper';
import { GTFS_CONFIG } from '../../core/config';

export class VehiclesService {
    constructor(public readonly city: CityConfig) {}

    protected async getCoreData() {
        const rtUrl = this.city.adapterConfig?.realtimeUrl;
        if (!rtUrl) {
            throw new Error(`Missing GTFS-RT URL configuration for ${this.city.slug}.`);
        }

        const rtPromise = getGtfsRtFeed(this.city.slug, rtUrl).catch((err) => {
            console.error(`GTFS-RT feed error for ${this.city.slug}:`, err.message);
            return null; // Gracefully degrade to static-only if feed is unreachable (e.g. 404)
        });
        const gtfsDataPromise = getGtfsData(this.city.slug);

        return Promise.all([rtPromise, gtfsDataPromise]);
    }

    async getSingleLiveVehicle(vehicleId: string, gtfsTripId?: string): Promise<{ liveMatch?: AppVehicleFeature, lastStopId?: string }> {
        const [feed, gtfsData] = await this.getCoreData();
        if (!feed || !feed.entity || feed.entity.length === 0) return {};

        // GTFS-RT entities may use tripId as id, or vehicleId as id.
        // The frontend currently passes either 'vehicleId' (like 1207) or we can use 'gtfsTripId'
        let rawMatch = null;
        if (gtfsTripId) {
            rawMatch = feed.entity.find(e => e.vehicle?.trip?.tripId === gtfsTripId);
        }
        if (!rawMatch && vehicleId) {
            rawMatch = feed.entity.find(e => 
                e.vehicle?.vehicle?.id === vehicleId || 
                e.vehicle?.vehicle?.label === vehicleId ||
                e.id === vehicleId
            );
        }

        if (!rawMatch || !rawMatch.vehicle) return {};

        const vp = rawMatch.vehicle;
        const tripId = vp.trip?.tripId || gtfsTripId || '';
        if (!tripId) return {};

        const tripRoutes = gtfsData.tripRoutes;
        const routeInfo = tripRoutes[tripId];
        if (!routeInfo) return {};

        const routeId = routeInfo.split('|')[0];
        const route = gtfsData.routes[routeId];
        if (!route) return {};

        const lastUpdate = vp.timestamp ? Number(vp.timestamp) * 1000 : Date.now();
        // Delay is not in VehiclePosition (it would be in TripUpdate), so we pass null
        const liveMatch = VehiclesMapper.mapVehicle(vp, tripId, route, lastUpdate, null);

        return { 
            liveMatch, 
            lastStopId: vp.stopId?.toString() 
        };
    }

    async getCachedMappedVehicles(): Promise<AppVehicleCollection> {
        return CacheManager.getOrFetch<AppVehicleCollection>(
            `gtfs_vehicles_collection_${this.city.slug}`, 
            CACHE_TTL.SHORT_DEBOUNCE_MS, 
            async () => {
                const [feed, gtfsData] = await this.getCoreData();

                if (!feed || !feed.entity) {
                    return { type: 'FeatureCollection', features: [], status: 'upstream_offline' };
                }

                const features: AppVehicleFeature[] = [];
                // Filter out vehicles that haven't updated in GTFS_CONFIG.VEHICLES_STALE_THRESHOLD_MS
                const nowMs = Date.now();

                for (const entity of feed.entity) {
                    if (!entity.vehicle) continue;
                    const vp = entity.vehicle;
                    
                    const tripId = vp.trip?.tripId;
                    if (!tripId) continue;

                    const lastUpdate = vp.timestamp ? Number(vp.timestamp) * 1000 : nowMs;
                    if (nowMs - lastUpdate > GTFS_CONFIG.VEHICLES_STALE_THRESHOLD_MS) {
                        continue;
                    }

                    const routeInfo = gtfsData.tripRoutes[tripId];
                    if (!routeInfo) continue;

                    const routeId = routeInfo.split('|')[0];
                    const route = gtfsData.routes[routeId];
                    if (!route) continue;

                    features.push(VehiclesMapper.mapVehicle(vp, tripId, route, lastUpdate, null));
                }

                return { type: 'FeatureCollection', features, status: 'ok' };
            },
            (col) => !col || col.status === 'upstream_offline' || !col.features || col.features.length === 0
        );
    }

    async getFilteredVehicles(ctx: EventContext<Env, string, unknown>): Promise<AppVehicleCollection> {
        const allVehicles = await this.getCachedMappedVehicles();

        const { searchParams } = new URL(ctx.request.url);
        const { routeType: routeTypes, routeShortName: routeShortNames, bounds } = parseSearchParams(searchParams, vehicleQuerySchema);
        let filtered = allVehicles.features;

        if (routeTypes && routeTypes.length > 0) {
            const allowedTypes = new Set(routeTypes.map(r => r.toLowerCase()));
            filtered = filtered.filter(f => allowedTypes.has(f.properties.route_type));
        }

        if (routeShortNames && routeShortNames.length > 0) {
            const allowedNames = new Set(routeShortNames.map(r => r.toUpperCase()));
            filtered = filtered.filter(f => allowedNames.has(f.properties.route_short_name.toString().toUpperCase()));
        }

        if (bounds) {
            const [minLat, minLng, maxLat, maxLng] = bounds.split(',').map(Number);
            filtered = filtered.filter(f => {
                if (!f.geometry || !f.geometry.coordinates) return false;
                const [lng, lat] = f.geometry.coordinates;
                return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
            });
        }

        return {
            type: 'FeatureCollection',
            features: filtered,
            status: allVehicles.status
        };
    }

    async getStats(): Promise<AppCityStats> {
        const allVehicles = await this.getCachedMappedVehicles();
        const features = allVehicles.features || [];
        return aggregateCityStats(features);
    }
}
