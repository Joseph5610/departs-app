import type { AppVehicleCollection, CityRequestContext } from "../../_core/types";
import type { CityConfig } from '../../_core/city-config';
import { parseSearchParams, vehicleQuerySchema } from '../../_core/schemas';
import { filterVehicles, isUnfiltered } from '../../_core/utils/vehicleFilter';
import { OFFLINE_VEHICLES } from '../../_core/feed/freshness';
import { vehiclesBody, vehiclesBodyFromJson, type VehiclesBody } from '../../_core/feed/vehicles-body';
import type { SingleLiveVehicle } from './vehicle-source';
import type { EdgeFleetSource } from './edge-fleet-source';
import type { VehiclesUseCase } from '../use-cases';

/**
 * Vehicles of every city. Where they come from is the network behind the `EdgeFleetSource`; filtering,
 * stats and the lookups boards and details make are the same for every network.
 */
export class VehiclesService implements VehiclesUseCase {
    constructor(
        public readonly city: CityConfig,
        private readonly source: EdgeFleetSource
    ) {}

    /**
     * Every vehicle in the network with the status its age earns it, which is what every caller
     * outside this class reads: past `FEED_AGE_S.OFFLINE` it holds no positions at all, so a
     * departure board or a detail cannot show one the map has already dropped.
     *
     * `waitUntil`, when the caller has one, lets the fleet cache refresh in the background
     * instead of this call paying for it.
     */
    async getCachedMappedVehicles(waitUntil?: (promise: Promise<unknown>) => void): Promise<AppVehicleCollection> {
        return this.source.aged(waitUntil);
    }

    /** Live vehicles for a known set of trips, for departure boards. */
    async getLiveVehiclesForTrips(tripIds: Set<string>, waitUntil?: (promise: Promise<unknown>) => void): Promise<AppVehicleCollection | null> {
        return this.source.forTrips(tripIds, waitUntil);
    }

    /** The live position of one vehicle, for a detail request that names its vehicle and trip. */
    async getSingleLiveVehicle(vehicleId: string, gtfsTripId?: string): Promise<SingleLiveVehicle> {
        return this.source.find(vehicleId, gtfsTripId);
    }

    async getVehicles(ctx: CityRequestContext): Promise<AppVehicleCollection> {
        return filterVehicles(await this.getCachedMappedVehicles(ctx.waitUntil), parseSearchParams(ctx.url.searchParams, vehicleQuerySchema));
    }

    /** The unfiltered map request, answered from the stored fleet JSON without re-serializing it. */
    async getVehiclesBody(ctx: CityRequestContext): Promise<VehiclesBody | null> {
        if (!isUnfiltered(parseSearchParams(ctx.url.searchParams, vehicleQuerySchema))) return null;
        const fleet = await this.source.allJson(ctx.waitUntil);
        return fleet
            ? vehiclesBodyFromJson(fleet.json, fleet.lastUpdated ? Date.parse(fleet.lastUpdated) : NaN, fleet.lastUpdated)
            : vehiclesBody(OFFLINE_VEHICLES);
    }
}
