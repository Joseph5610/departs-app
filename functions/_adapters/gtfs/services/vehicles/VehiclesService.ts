import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppVehicleCollection, AppVehicleFeature, AppCityStats } from "../../../../_core/types";
import type { CityConfig } from '../../../../_core/city-config';
import { CacheManager, MEMORY_CACHE_TTL } from '../../../../_core/utils/CacheManager';
import { getGtfsRoutes, getGtfsTripRoutes, type GtfsRoutesData, type GtfsTripRoutesData } from '../../core/gtfs-data';
import { aggregateCityStats } from '../../../../_core/utils/statsAggregator';
import { parseSearchParams, vehicleQuerySchema } from '../../../../_core/schemas';
import { filterVehicles } from '../../../../_core/utils/vehicleFilter';
import { getGtfsRtFeed } from '../../core/gtfs-rt-feed';
import { VehiclesMapper } from './VehiclesMapper';
import { GTFS_CONFIG } from '../../core/config';
import { transit_realtime } from 'gtfs-realtime-bindings';

export class VehiclesService {
    constructor(public readonly city: CityConfig) {}

    protected async getCoreData() {
        const rtPromise = getGtfsRtFeed(this.city).catch((err) => {
            console.error(`GTFS-RT feed error for ${this.city.slug}:`, err.message);
            return null; // Gracefully degrade to static-only if feed is unreachable (e.g. 404)
        });
        const gtfsDataPromise = getGtfsRoutes(this.city.slug);
        const gtfsTripRoutesPromise = getGtfsTripRoutes(this.city.slug);

        return Promise.all([rtPromise, gtfsDataPromise, gtfsTripRoutesPromise]);
    }

    /**
     * Hook: excludes feed entities that must never be surfaced for this network.
     * The generic GTFS feed surfaces everything.
     */
    protected isRelevantEntity(_entity: transit_realtime.IFeedEntity): boolean {
        return true;
    }

    /** Hook: whether a raw feed entity belongs to the given trip. */
    protected matchesTripId(
        entity: transit_realtime.IFeedEntity,
        gtfsTripId: string,
        _tripRoutes: GtfsTripRoutesData
    ): boolean {
        return entity.vehicle?.trip?.tripId === gtfsTripId;
    }

    /** Hook: whether a raw feed entity refers to the given vehicle. */
    protected matchesVehicleId(entity: transit_realtime.IFeedEntity, vehicleId: string): boolean {
        const descriptor = entity.vehicle?.vehicle;
        return descriptor?.id === vehicleId
            || descriptor?.label === vehicleId
            || entity.id === vehicleId;
    }

    /** Hook: the trip a feed entity is serving, preferring the requested one. */
    protected resolveEntityTripId(
        entity: transit_realtime.IFeedEntity,
        _requestedTripId: string | undefined,
        tripRoutes: GtfsTripRoutesData
    ): string | undefined {
        const tripId = entity.vehicle?.trip?.tripId;
        return tripId && tripId in tripRoutes.tripRoutes ? tripId : undefined;
    }

    /** Hook: one feed entity as a vehicle feature; null when it is stale or its route is unknown. */
    protected async mapLiveEntity(
        entity: transit_realtime.IFeedEntity,
        tripId: string,
        gtfsData: GtfsRoutesData,
        tripRoutes: GtfsTripRoutesData
    ): Promise<AppVehicleFeature | null> {
        const vp = entity.vehicle;
        if (!vp) return null;

        const nowMs = Date.now();
        const lastUpdate = vp.timestamp ? Number(vp.timestamp) * 1000 : nowMs;
        if (nowMs - lastUpdate > GTFS_CONFIG.VEHICLES_STALE_THRESHOLD_MS) return null;

        const route = gtfsData.routes[tripRoutes.tripRoutes[tripId]];
        if (!route) return null;

        return VehiclesMapper.mapVehicle(vp, tripId, route, new Date(lastUpdate).toISOString(), null);
    }

    /**
     * The live position of one vehicle, read straight from the feed.
     *
     * Detail requests name their vehicle and trip, so they skip the per-request cost of resolving
     * every vehicle in the network to a trip, which only the map needs.
     */
    async getSingleLiveVehicle(vehicleId: string, gtfsTripId?: string): Promise<{ liveMatch?: AppVehicleFeature, lastStopId?: string }> {
        const [feed, gtfsData, tripRoutes] = await this.getCoreData();
        // Networks whose vehicles come from something other than a GTFS-RT feed (DÚK, Prešov) build
        // their own collection, so they are searched there instead.
        if (!feed?.entity) return { liveMatch: await this.findInMappedVehicles(vehicleId, gtfsTripId) };

        const entity = this.findRawEntity(feed.entity, vehicleId, gtfsTripId, tripRoutes);
        if (!entity?.vehicle) return {};

        const tripId = this.resolveEntityTripId(entity, gtfsTripId, tripRoutes);
        if (!tripId) return {};

        const liveMatch = await this.mapLiveEntity(entity, tripId, gtfsData, tripRoutes);
        if (!liveMatch) return {};

        return {
            liveMatch,
            // The raw stopId is deliberately kept off the public AppVehicleFeature.
            lastStopId: entity.vehicle.stopId?.toString()
        };
    }

    private findRawEntity(
        entities: transit_realtime.IFeedEntity[],
        vehicleId: string,
        gtfsTripId: string | undefined,
        tripRoutes: GtfsTripRoutesData
    ): transit_realtime.IFeedEntity | undefined {
        // The requested vehicle wins over its trip: a trip lookup can land on a different vehicle, which
        // would move the selection. A trip-only match still serves a stale or unknown vehicle id.
        let vehicleOnly: transit_realtime.IFeedEntity | undefined;
        let tripOnly: transit_realtime.IFeedEntity | undefined;
        for (const entity of entities) {
            if (!this.isRelevantEntity(entity)) continue;
            const onTrip = !!gtfsTripId && this.matchesTripId(entity, gtfsTripId, tripRoutes);
            if (!vehicleId || this.matchesVehicleId(entity, vehicleId)) {
                if (onTrip) return entity;
                if (vehicleId && !vehicleOnly) vehicleOnly = entity;
            } else if (onTrip && !tripOnly) {
                tripOnly = entity;
            }
        }
        return vehicleOnly ?? tripOnly;
    }

    /** The requested vehicle, else its trip, in this city's mapped collection. */
    private async findInMappedVehicles(vehicleId: string, gtfsTripId?: string): Promise<AppVehicleFeature | undefined> {
        const { features } = await this.getCachedMappedVehicles();
        let byTrip: AppVehicleFeature | undefined;
        for (const feature of features) {
            const props = feature.properties;
            if (vehicleId && (props.vehicle_id === vehicleId || String(props.vehicle_descriptor?.vehicle_registration_number ?? '') === vehicleId)) return feature;
            if (gtfsTripId && !byTrip && props.gtfs_trip_id === gtfsTripId) byTrip = feature;
        }
        return byTrip;
    }

    async getCachedMappedVehicles(): Promise<AppVehicleCollection> {
        return CacheManager.getOrFetch<AppVehicleCollection>(
            `gtfs_vehicles_collection_${this.city.slug}`, 
            MEMORY_CACHE_TTL.SHORT_DEBOUNCE_MS, 
            async () => {
                const [feed, gtfsData, tripRoutes] = await this.getCoreData();

                if (!feed || !feed.entity) {
                    return { type: 'FeatureCollection', features: [], status: 'upstream_offline' };
                }

                const features: AppVehicleFeature[] = [];
                // Filter out vehicles that haven't updated in GTFS_CONFIG.VEHICLES_STALE_THRESHOLD_MS
                const nowMs = Date.now();
                const defaultIsoStr = new Date(nowMs).toISOString();

                for (let i = 0; i < feed.entity.length; i++) {
                    const entity = feed.entity[i];
                    if (!entity.vehicle) continue;
                    const vp = entity.vehicle;
                    
                    const tripId = vp.trip?.tripId;
                    if (!tripId) continue;

                    const lastUpdate = vp.timestamp ? Number(vp.timestamp) * 1000 : nowMs;
                    if (nowMs - lastUpdate > GTFS_CONFIG.VEHICLES_STALE_THRESHOLD_MS) {
                        continue;
                    }

                    const routeInfo = tripRoutes.tripRoutes[tripId];
                    if (!routeInfo) continue;

                    const route = gtfsData.routes[routeInfo];
                    if (!route) continue;

                    const originTimestamp = lastUpdate === nowMs ? defaultIsoStr : new Date(lastUpdate).toISOString();
                    features.push(VehiclesMapper.mapVehicle(vp, tripId, route, originTimestamp, null));
                }

                return { type: 'FeatureCollection', features, status: 'ok' };
            },
            (col) => !col || col.status === 'upstream_offline' || !col.features || col.features.length === 0
        );
    }

    async getFilteredVehicles(ctx: EventContext<Env, string, unknown>): Promise<AppVehicleCollection> {
        const { searchParams } = new URL(ctx.request.url);
        return filterVehicles(await this.getCachedMappedVehicles(), parseSearchParams(searchParams, vehicleQuerySchema));
    }

    async getStats(): Promise<AppCityStats> {
        const allVehicles = await this.getCachedMappedVehicles();
        const features = allVehicles.features || [];
        return aggregateCityStats(features);
    }
}
