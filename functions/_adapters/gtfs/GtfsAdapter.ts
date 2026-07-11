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

export class GtfsAdapter implements CityAdapter {
    private stopsService: StopsService;

    constructor(private _city: CityConfig) {
        this.stopsService = new StopsService(this._city);
    }

    async handleStops(ctx: EventContext<Env, string, unknown>): Promise<AppStopCollection> {
        void ctx;
        return this.stopsService.getStops();
    }
    
    async handleVehicles(ctx: EventContext<Env, string, unknown>): Promise<AppVehicleCollection> {
        void ctx;
        return { type: 'FeatureCollection', features: [] };
    }
    
    async handleDepartures(ctx: EventContext<Env, string, unknown>): Promise<AppDepartureResponse> {
        return new DeparturesService(this._city).getDepartures(ctx);
    }
    
    async handleVehicleDetail(ctx: EventContext<Env, string, unknown>): Promise<AppVehicleDetail> {
        return new VehicleDetailService(this._city).getVehicleDetail(ctx);
    }
    
    async handleAlerts(ctx: EventContext<Env, string, unknown>): Promise<AppAlertsResponse> {
        void ctx;
        return new AlertsService(this._city).getAlerts();
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
