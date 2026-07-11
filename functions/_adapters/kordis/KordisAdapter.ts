import type { EventContext } from "@cloudflare/workers-types";
import type { CityConfig } from '../../_core/city-config';
import { GtfsAdapter } from '../gtfs/GtfsAdapter';
import type { Env, AppVehicleCollection } from "../../_core/types";
import { KordisArcGisVehiclesService } from './services/vehicles/KordisArcGisVehiclesService';
import { KordisGtfsRtVehiclesService } from './services/vehicles/KordisGtfsRtVehiclesService';
import { VehicleDetailService } from '../gtfs/services/vehicles/VehicleDetailService';
import { KordisVehicleDetailEnricher } from './services/vehicles/KordisVehicleDetailEnricher';
import { AlertsService } from '../gtfs/services/alerts/AlertsService';
import { KordisAlertsMapper } from './services/alerts/KordisAlertsMapper';

export class KordisAdapter extends GtfsAdapter {
    private kordisVehiclesService: KordisArcGisVehiclesService;
    private readonly useGtfsRt: boolean;

    constructor(protected readonly city: CityConfig) {
        super(city);
        this.kordisVehiclesService = new KordisArcGisVehiclesService(city);
        this.useGtfsRt = this.city.adapterConfig?.useGtfsRtVehicles === true;

        if (this.useGtfsRt) {
            this.vehiclesService = new KordisGtfsRtVehiclesService(city);
        }

        // Inject the Kordis-specific enricher into the base VehicleDetailService
        this.vehicleDetailService = new VehicleDetailService(
            this.city,
            new KordisVehicleDetailEnricher(this.vehiclesService, this.kordisVehiclesService, this.useGtfsRt)
        );

        // Inject the Kordis-specific alerts mapper
        this.alertsService = new AlertsService(this.city, new KordisAlertsMapper());
    }

    async handleVehicles(ctx: EventContext<Env, string, unknown>): Promise<AppVehicleCollection> {
        if (this.useGtfsRt) {
            return super.handleVehicles(ctx);
        }
        return this.kordisVehiclesService.getFilteredVehicles(ctx);
    }
}
