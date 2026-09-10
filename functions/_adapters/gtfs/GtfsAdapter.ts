import type { CityConfig } from '../../_core/city-config';
import type { CityAdapter } from '../CityAdapter';
import type { EventContext } from "@cloudflare/workers-types";

import type { Env, AppStopCollection, AppVehicleCollection, AppDepartureResponse, AppVehicleDetail, AppAlertsResponse, AppInfotext, AppCityStats } from "../../_core/types";

import { StopsService } from './services/stops/StopsService';
import { DeparturesService } from './services/departures/DeparturesService';
import { VehicleDetailService } from './services/vehicles/VehicleDetailService';
import { AlertsService } from './services/alerts/AlertsService';
import { InfotextsService } from './services/infotexts/InfotextsService';

import { GtfsRtVehicleDetailEnricher } from './services/vehicles/GtfsRtVehicleDetailEnricher';
import type { VehicleDetailEnricher } from './services/vehicles/VehicleDetailEnricher';
import { VehiclesService } from './services/vehicles/VehiclesService';
import { BaseGtfsAlertsMapper } from './services/alerts/BaseGtfsAlertsMapper';
import { getGtfsRtFeed } from './core/gtfs-rt-feed';

export class GtfsAdapter implements CityAdapter {
    protected readonly stopsService: StopsService;
    protected readonly vehiclesService: VehiclesService;
    protected readonly vehicleDetailService: VehicleDetailService;
    protected readonly alertsService: AlertsService;

    constructor(public readonly city: CityConfig) {
        this.stopsService = new StopsService(city);
        this.vehiclesService = this.createVehiclesService();
        this.vehicleDetailService = new VehicleDetailService(city, this.createDetailEnricher(this.vehiclesService));
        this.alertsService = new AlertsService(city, this.createAlertsMapper());
    }

    /** Override points for networks that need their own behaviour. Must only read `this.city`. */
    protected createVehiclesService(): VehiclesService {
        return new VehiclesService(this.city);
    }

    protected createDetailEnricher(vehiclesService: VehiclesService): VehicleDetailEnricher {
        return new GtfsRtVehicleDetailEnricher(vehiclesService);
    }

    protected createAlertsMapper(): BaseGtfsAlertsMapper {
        return new BaseGtfsAlertsMapper();
    }

    async handleStops(_ctx: EventContext<Env, string, unknown>): Promise<AppStopCollection> {
        return this.stopsService.getStops();
    }
    
    async handleVehicles(ctx: EventContext<Env, string, unknown>): Promise<AppVehicleCollection> {
        return this.vehiclesService.getFilteredVehicles(ctx);
    }
    
    /**
     * Processes departures by injecting the underlying VehiclesService into the DeparturesService.
     * This allows the departure board to access the live vehicle feed for delays and enriched metadata.
     */
    async handleDepartures(ctx: EventContext<Env, string, unknown>): Promise<AppDepartureResponse> {
        return new DeparturesService(this.city, this.vehiclesService).getDepartures(ctx);
    }
    
    async handleVehicleDetail(ctx: EventContext<Env, string, unknown>): Promise<AppVehicleDetail> {
        return this.vehicleDetailService.getVehicleDetail(ctx);
    }
    
    async handleAlerts(_ctx: EventContext<Env, string, unknown>): Promise<AppAlertsResponse> {
        return this.alertsService.getAlerts();
    }
    
    async handleInfotexts(_ctx: EventContext<Env, string, unknown>): Promise<AppInfotext[]> {
        return new InfotextsService(this.city).getInfotexts();
    }

    async handleRawFeed(_ctx: EventContext<Env, string, unknown>, type: string = 'vehicles'): Promise<unknown> {
        const feed = await getGtfsRtFeed(this.city);
        
        // Return raw feed entities based on requested type
        if (type === 'alerts') {
            return feed.entity.filter(e => e.alert != null);
        }
        return feed;
    }

    async handleStats(_ctx: EventContext<Env, string, unknown>): Promise<AppCityStats> {
        return this.vehiclesService.getStats();
    }
}
