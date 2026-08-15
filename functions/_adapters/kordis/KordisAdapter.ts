import type { CityConfig } from '../../_core/city-config';
import { GtfsAdapter } from '../gtfs/GtfsAdapter';
import { KordisGtfsRtVehiclesService } from './services/vehicles/KordisGtfsRtVehiclesService';
import { VehicleDetailService } from '../gtfs/services/vehicles/VehicleDetailService';
import { KordisVehicleDetailEnricher } from './services/vehicles/KordisVehicleDetailEnricher';
import { AlertsService } from '../gtfs/services/alerts/AlertsService';
import { KordisAlertsMapper } from './services/alerts/KordisAlertsMapper';

export class KordisAdapter extends GtfsAdapter {
    constructor(public readonly city: CityConfig) {
        super(city);
        
        this.vehiclesService = new KordisGtfsRtVehiclesService(city);

        // Inject the Kordis-specific enricher into the base VehicleDetailService
        this.vehicleDetailService = new VehicleDetailService(
            this.city,
            new KordisVehicleDetailEnricher(this.vehiclesService)
        );

        // Inject the Kordis-specific alerts mapper
        this.alertsService = new AlertsService(this.city, new KordisAlertsMapper());
    }
}
