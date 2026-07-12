import type { CityConfig } from '../../_core/city-config';
import type { CityAdapter } from '../CityAdapter';
import type { EventContext } from "@cloudflare/workers-types";
import { transit_realtime } from "gtfs-realtime-bindings";
import type { Env, AppStopCollection, AppVehicleCollection, AppDepartureResponse, AppVehicleDetail, AppAlertsResponse, AppInfotext } from "../../_core/types";

import { StopsService } from './services/stops/StopsService';
import { DeparturesService } from './services/departures/DeparturesService';
import { VehicleDetailService } from './services/vehicles/VehicleDetailService';
import { AlertsService } from './services/alerts/AlertsService';
import { InfotextsService } from './services/infotexts/InfotextsService';
import { appClient } from '../../_core/ApiClient';
import { GtfsRtVehicleDetailEnricher } from './services/vehicles/GtfsRtVehicleDetailEnricher';
import { VehiclesService } from './services/vehicles/VehiclesService';
import { BaseGtfsAlertsMapper } from './services/alerts/BaseGtfsAlertsMapper';

export class GtfsAdapter implements CityAdapter {
    protected stopsService: StopsService;
    protected vehiclesService: VehiclesService;
    protected vehicleDetailService: VehicleDetailService;
    protected alertsService: AlertsService;

    constructor(protected _city: CityConfig) {
        this.stopsService = new StopsService(this._city);
        this.vehiclesService = new VehiclesService(this._city);
        this.vehicleDetailService = new VehicleDetailService(this._city, new GtfsRtVehicleDetailEnricher(this.vehiclesService));
        this.alertsService = new AlertsService(this._city, new BaseGtfsAlertsMapper());
    }

    async handleStops(ctx: EventContext<Env, string, unknown>): Promise<AppStopCollection> {
        void ctx;
        return this.stopsService.getStops();
    }
    
    async handleVehicles(ctx: EventContext<Env, string, unknown>): Promise<AppVehicleCollection> {
        return this.vehiclesService.getFilteredVehicles(ctx);
    }
    
    async getSingleLiveVehicle(vehicleId: string, gtfsTripId?: string) {
        return this.vehiclesService.getSingleLiveVehicle(vehicleId, gtfsTripId);
    }
    
    async handleDepartures(ctx: EventContext<Env, string, unknown>): Promise<AppDepartureResponse> {
        return new DeparturesService(this._city).getDepartures(ctx);
    }
    
    async handleVehicleDetail(ctx: EventContext<Env, string, unknown>): Promise<AppVehicleDetail> {
        return this.vehicleDetailService.getVehicleDetail(ctx);
    }
    
    async handleAlerts(ctx: EventContext<Env, string, unknown>): Promise<AppAlertsResponse> {
        void ctx;
        return this.alertsService.getAlerts();
    }
    
    async handleInfotexts(ctx: EventContext<Env, string, unknown>): Promise<AppInfotext[]> {
        void ctx;
        return new InfotextsService(this._city).getInfotexts();
    }

    async handleRawFeed(_ctx?: EventContext<Env, string, unknown>, type: string = 'vehicles'): Promise<unknown> {
        const rtUrl = this._city.adapterConfig?.realtimeUrl;
        if (!rtUrl) {
            return { error: `No realtimeUrl configured for city: ${this._city.slug}` };
        }
        const response = await appClient.fetch(rtUrl);
        if (!response.ok) {
            throw new Error(`GTFS-RT fetch failed: ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        const feed = transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
        
        // Return raw feed entities based on requested type
        const entities = feed.entity as unknown[];
        if (type === 'alerts') {
            return (entities as Array<{ alert?: unknown }>).filter(e => e.alert);
        }
        return feed;
    }
}
