import type { CityConfig } from '../../_core/city-config';
import type { Env, AppVehicleDetail } from '../../_core/types';
import { ApiError } from '../../_core/errors';
import { ERROR_MESSAGES } from '../../_core/api-utils';
import type { CityAdapter } from '../CityAdapter';
import type { EventContext } from "@cloudflare/workers-types";
import { DukVehiclesService } from './services/vehicles/DukVehiclesService';
import { DukStopsService } from './services/stops/DukStopsService';
import { DukDeparturesService } from './services/departures/DukDeparturesService';

/**
 * Adapter for the Ústecký kraj (DÚK) transit network.
 * 
 * Note: We rely heavily on the `/cis` namespace endpoints from Portabo, 
 * as they contain both regional transit (DÚK) AND inner-city transit (MHD) 
 * data, whereas `/duk` only contains regional green buses.
 */
export class DukAdapter implements CityAdapter {
    private vehiclesService: DukVehiclesService;
    private stopsService: DukStopsService;
    private departuresService: DukDeparturesService;

    constructor(private city: CityConfig) {
        this.vehiclesService = new DukVehiclesService(this.city);
        this.stopsService = new DukStopsService(this.city);
        this.departuresService = new DukDeparturesService(this.city);
    }

    /**
     * Handles fetching the live map vehicle positions.
     */
    async handleVehicles() {
        return this.vehiclesService.getVehicles();
    }

    async handleStops() {
        return this.stopsService.getStops();
    }

    /**
     * Handles fetching the departure boards for a specific stop/pole.
     */
    async handleDepartures(ctx: EventContext<Env, string, unknown>) {
        const { searchParams } = new URL(ctx.request.url);
        return this.departuresService.getDepartures(ctx.env, searchParams); // Still requires params
    }

    /**
     * Handles fetching detailed information for a single live vehicle.
     * Searches the `/cis/GetTraffic` feed to find the specific ID.
     */
    async handleVehicleDetail(ctx: EventContext<Env, string, unknown>): Promise<AppVehicleDetail> {
        const { searchParams } = new URL(ctx.request.url);
        const vehicleId = searchParams.get('id');
        
        if (!vehicleId) {
            throw new ApiError(ERROR_MESSAGES.MISSING_PARAMS, 400);
        }

        const vehicleDetail = await this.vehiclesService.getSingleLiveVehicle(vehicleId);
        
        if (!vehicleDetail) {
            throw new ApiError(ERROR_MESSAGES.VEHICLE_NOT_FOUND, 404);
        }
        
        return vehicleDetail;
    }

    /**
     * Handles fetching alerts. Not yet implemented for DUK.
     */
    async handleAlerts() {
        return { alerts: [] };
    }

    /**
     * Handles fetching infotexts. Not yet implemented for DUK.
     */
    async handleInfotexts() {
        return [];
    }

    /**
     * Handles fetching raw GTFS feed. Not implemented for DUK.
     */
    async handleRawFeed() {
        return { error: "Not implemented for DUK" };
    }
}
