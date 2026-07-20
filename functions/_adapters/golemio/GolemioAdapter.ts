import type { CityConfig } from '../../_core/city-config';
import type { Env } from '../../_core/types';
import type { CityAdapter } from '../CityAdapter';
import type { EventContext } from "@cloudflare/workers-types";

import { GolemioClient } from './core/GolemioClient';
import { StopsService } from './services/stops/StopsService';
import { VehiclesService } from './services/vehicles/VehiclesService';
import { VehicleDetailService } from './services/vehicles/VehicleDetailService';
import { DeparturesService } from './services/departures/DeparturesService';
import { AlertsService } from './services/alerts/AlertsService';
import { InfotextsService } from './services/infotexts/InfotextsService';

/**
 * Golemio API adapter implementation.
 * Acts as a facade routing incoming API requests to the appropriate domain services.
 * Implements the CityAdapter interface for multi-city compatibility.
 */
export class GolemioAdapter implements CityAdapter {
    private client: GolemioClient;
    private stopsService: StopsService;
    private vehiclesService: VehiclesService;
    private vehicleDetailService: VehicleDetailService;
    private departuresService: DeparturesService;
    private alertsService: AlertsService;
    private infotextsService: InfotextsService;

    constructor(private city: CityConfig) {
        this.client = new GolemioClient();
        this.stopsService = new StopsService(this.client);
        this.vehiclesService = new VehiclesService(this.client);
        this.vehicleDetailService = new VehicleDetailService(this.client);
        this.departuresService = new DeparturesService(this.client);
        this.alertsService = new AlertsService(this.client);
        this.infotextsService = new InfotextsService(this.client);
    }

    /**
     * Routes stop-related requests to StopsService.
     */
    handleStops(ctx: EventContext<Env, string, unknown>) { 
        return this.stopsService.getStops(ctx.env); 
    }

    /**
     * Routes active vehicle positions requests to VehiclesService.
     */
    handleVehicles(ctx: EventContext<Env, string, unknown>) { 
        const { searchParams } = new URL(ctx.request.url);
        return this.vehiclesService.getVehicles(ctx.env, searchParams); 
    }

    /**
     * Routes departure board requests to DeparturesService.
     */
    handleDepartures(ctx: EventContext<Env, string, unknown>) { 
        const { searchParams } = new URL(ctx.request.url);
        return this.departuresService.getDepartures(ctx.env, searchParams); 
    }

    /**
     * Routes detailed vehicle and trip requests to VehicleDetailService.
     */
    handleVehicleDetail(ctx: EventContext<Env, string, unknown>) { 
        const { searchParams } = new URL(ctx.request.url);
        return this.vehicleDetailService.getVehicleDetail(ctx.env, searchParams); 
    }

    /**
     * Routes transit alert requests to AlertsService.
     */
    handleAlerts(ctx: EventContext<Env, string, unknown>) { 
        return this.alertsService.getAlerts(ctx.env); 
    }

    /**
     * Routes transit infotext requests to InfotextsService.
     */
    handleInfotexts(ctx: EventContext<Env, string, unknown>) {
        return this.infotextsService.getInfotexts(ctx.env);
    }

    /**
     * Returns raw upstream Golemio or PID XML JSON
     */
    async handleRawFeed(ctx: EventContext<Env, string, unknown>, type: string = 'vehicles') {
        if (type === 'alerts') {
            return this.alertsService.getRawFeed(ctx.env);
        }

        return this.vehiclesService.getRawVehicles(ctx.env);
    }

    /**
     * Calculates city-wide statistics based on raw vehicles.
     */
    handleStats(ctx: EventContext<Env, string, unknown>) {
        return this.vehiclesService.getStats(ctx.env);
    }
}
