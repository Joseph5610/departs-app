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
import { VehiclesService } from './services/vehicles/VehiclesService';
import { BaseGtfsAlertsMapper } from './services/alerts/BaseGtfsAlertsMapper';
import { getGtfsRtFeed } from './core/gtfs-rt-feed';

export class GtfsAdapter implements CityAdapter {
    protected stopsService: StopsService;
    protected vehiclesService: VehiclesService;
    protected vehicleDetailService: VehicleDetailService;
    protected alertsService: AlertsService;

    constructor(public readonly city: CityConfig) {
        this.stopsService = new StopsService(this.city);
        this.vehiclesService = new VehiclesService(this.city);
        this.vehicleDetailService = new VehicleDetailService(this.city, new GtfsRtVehicleDetailEnricher(this.vehiclesService));
        this.alertsService = new AlertsService(this.city, new BaseGtfsAlertsMapper());
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
        const rtUrl = this.city.adapterConfig?.realtimeUrl;
        if (!rtUrl) {
            return { error: `No realtimeUrl configured for city: ${this.city.slug}` };
        }
        
        const feed = await getGtfsRtFeed(this.city.slug, rtUrl);
        if (!feed) {
            throw new Error(`GTFS-RT fetch failed for city: ${this.city.slug}`);
        }
        
        // Return raw feed entities based on requested type
        const entities = feed.entity as unknown[];
        if (type === 'alerts') {
            return (entities as Array<{ alert?: unknown }>).filter(e => e.alert);
        }
        return feed;
    }

    async handleStats(_ctx: EventContext<Env, string, unknown>): Promise<AppCityStats> {
        return this.vehiclesService.getStats();
    }
}
