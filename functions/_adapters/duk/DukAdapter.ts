import type { CityConfig } from '../../_core/city-config';
import type { Env, AppVehicleDetail, AppCityStats } from '../../_core/types';
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

    async handleRawFeed() {
        return { error: "Not implemented for DUK" };
    }

    async handleStats(_ctx: EventContext<Env, string, unknown>): Promise<AppCityStats> {
        return {
            total_vehicles: 0,
            total_lines: 0,
            average_delay: null,
            low_floor_count: 0,
            air_conditioned_count: 0,
            delayed_over_5_min_count: 0,
            delay_distribution: { on_time: 0, delayed_1_to_5: 0, delayed_5_plus: 0 },
            state_distribution: { in_transit: 0, at_stop: 0, off_track: 0, other: 0 },
            total_delay_seconds: 0,
            vehicle_types: {},
            busiest_lines: [],
            most_delayed: [],
            timestamp: new Date().toISOString()
        };
    }
}
