import type { AppVehicleCollection, AppVehicleFeature, CityRequestContext } from "../../../_core/types";
import type { CityConfig } from '../../../_core/city-config';
import { parseSearchParams, vehicleQuerySchema } from '../../../_core/schemas';
import { filterVehicles, isUnfiltered } from '../../../_core/utils/vehicleFilter';
import { withFeedAge } from '../../../_core/feed/freshness';
import { vehiclesBody, type VehiclesBody } from '../../../_core/feed/vehicles-body';
import type { SingleLiveVehicle, VehicleSource } from './vehicle-source';
import type { VehiclesUseCase } from '../../use-cases';

/**
 * Vehicles of a city on the GTFS stack. Where they come from is the `VehicleSource`; filtering,
 * stats and the lookups boards and details make are the same for every source.
 */
export class VehiclesService implements VehiclesUseCase {
    constructor(
        public readonly city: CityConfig,
        private readonly source: VehicleSource
    ) {}

    /**
     * Every vehicle in the network with the status its age earns it, which is what every caller
     * outside this class reads: past `FEED_AGE_S.OFFLINE` it holds no positions at all, so a
     * departure board or a detail cannot show one the map has already dropped.
     *
     * `waitUntil`, when the caller has one, lets a source refresh its own cache in the background
     * instead of this call paying for it; omitted, the source falls back to building synchronously.
     */
    async getCachedMappedVehicles(waitUntil?: (promise: Promise<unknown>) => void): Promise<AppVehicleCollection> {
        return withFeedAge(await this.source.all(waitUntil));
    }

    /** Live vehicles for a known set of trips, for departure boards. */
    async getLiveVehiclesForTrips(tripIds: Set<string>, waitUntil?: (promise: Promise<unknown>) => void): Promise<AppVehicleCollection | null> {
        return this.source.forTrips ? this.source.forTrips(tripIds, waitUntil) : this.getCachedMappedVehicles(waitUntil);
    }

    /** The live position of one vehicle, for a detail request that names its vehicle and trip. */
    async getSingleLiveVehicle(vehicleId: string, gtfsTripId?: string): Promise<SingleLiveVehicle> {
        const result = this.source.find
            ? await this.source.find(vehicleId, gtfsTripId)
            : { liveMatch: await this.findInMappedVehicles(vehicleId, gtfsTripId) };
        return this.source.augmentSingleLiveVehicle ? this.source.augmentSingleLiveVehicle(result) : result;
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

    async getVehicles(ctx: CityRequestContext): Promise<AppVehicleCollection> {
        return filterVehicles(await this.getCachedMappedVehicles(ctx.waitUntil), parseSearchParams(ctx.url.searchParams, vehicleQuerySchema));
    }

    /** The unfiltered map request, answered from the source's collection serialized once. */
    async getVehiclesBody(ctx: CityRequestContext): Promise<VehiclesBody | null> {
        if (!isUnfiltered(parseSearchParams(ctx.url.searchParams, vehicleQuerySchema))) return null;
        return vehiclesBody(await this.source.all(ctx.waitUntil));
    }
}
