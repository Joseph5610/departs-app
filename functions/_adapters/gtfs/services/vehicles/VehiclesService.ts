import type { EventContext } from "@cloudflare/workers-types";
import type { Env, AppVehicleCollection, AppVehicleFeature, AppCityStats } from "../../../../_core/types";
import type { CityConfig } from '../../../../_core/city-config';
import { CacheManager, CACHE_TTL } from '../../../../_core/utils/CacheManager';
import { getGtfsRoutes, getGtfsTripRoutes, type GtfsTripRoutesData } from '../../core/gtfs-data';
import { aggregateCityStats } from '../../../../_core/utils/statsAggregator';
import { parseSearchParams, vehicleQuerySchema } from '../../../../_core/schemas';
import { getGtfsRtFeed } from '../../core/gtfs-rt-feed';
import { VehiclesMapper } from './VehiclesMapper';
import { GTFS_CONFIG } from '../../core/config';
import { transit_realtime } from 'gtfs-realtime-bindings';

interface VehicleIndex {
    byTrip: Map<string, AppVehicleFeature>;
    byVehicle: Map<string, AppVehicleFeature>;
}

/**
 * Lookup indexes for a mapped vehicle collection.
 *
 * Keyed on the collection itself so an index lives exactly as long as the cached collection it
 * describes and is collected with it. Detail polls hit the same cached collection repeatedly, so
 * this turns a repeated O(N) scan over every vehicle into an O(1) lookup.
 */
const vehicleIndexes = new WeakMap<AppVehicleCollection, VehicleIndex>();

function getVehicleIndex(collection: AppVehicleCollection): VehicleIndex {
    const existing = vehicleIndexes.get(collection);
    if (existing) return existing;

    const index: VehicleIndex = { byTrip: new Map(), byVehicle: new Map() };
    for (const feature of collection.features) {
        const props = feature.properties;
        if (props.gtfs_trip_id && !index.byTrip.has(props.gtfs_trip_id)) {
            index.byTrip.set(props.gtfs_trip_id, feature);
        }
        if (props.vehicle_id && !index.byVehicle.has(props.vehicle_id)) {
            index.byVehicle.set(props.vehicle_id, feature);
        }
        const registration = props.vehicle_descriptor?.vehicle_registration_number;
        if (registration && !index.byVehicle.has(String(registration))) {
            index.byVehicle.set(String(registration), feature);
        }
    }

    vehicleIndexes.set(collection, index);
    return index;
}

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

    async getSingleLiveVehicle(vehicleId: string, gtfsTripId?: string): Promise<{ liveMatch?: AppVehicleFeature, lastStopId?: string }> {
        const collection = await this.getCachedMappedVehicles();
        if (!collection.features || collection.features.length === 0) return {};

        const index = getVehicleIndex(collection);
        const liveMatch = (gtfsTripId ? index.byTrip.get(gtfsTripId) : undefined)
            ?? (vehicleId ? index.byVehicle.get(vehicleId) : undefined);

        if (!liveMatch) return {};

        // The raw stopId is deliberately kept off the public AppVehicleFeature, so pull it from the
        // already-cached feed. Trip identity wins over vehicle identity: a vehicle may have moved on
        // to a later trip, in which case its current entity is not the one being asked about.
        const [feed, , tripRoutes] = await this.getCoreData();
        let lastStopId: string | undefined;

        if (feed && feed.entity) {
            const rawMatch = this.findRawEntity(feed.entity, vehicleId, gtfsTripId, tripRoutes);
            if (rawMatch?.vehicle?.stopId) {
                lastStopId = rawMatch.vehicle.stopId.toString();
            }
        }

        return {
            liveMatch,
            lastStopId
        };
    }

    private findRawEntity(
        entities: transit_realtime.IFeedEntity[],
        vehicleId: string,
        gtfsTripId: string | undefined,
        tripRoutes: GtfsTripRoutesData
    ): transit_realtime.IFeedEntity | undefined {
        if (gtfsTripId) {
            for (const entity of entities) {
                if (!this.isRelevantEntity(entity)) continue;
                if (this.matchesTripId(entity, gtfsTripId, tripRoutes)) return entity;
            }
        }

        if (vehicleId) {
            for (const entity of entities) {
                if (!this.isRelevantEntity(entity)) continue;
                if (this.matchesVehicleId(entity, vehicleId)) return entity;
            }
        }

        return undefined;
    }

    async getCachedMappedVehicles(): Promise<AppVehicleCollection> {
        return CacheManager.getOrFetch<AppVehicleCollection>(
            `gtfs_vehicles_collection_${this.city.slug}`, 
            CACHE_TTL.SHORT_DEBOUNCE_MS, 
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
