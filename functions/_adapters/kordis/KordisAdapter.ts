import { GtfsAdapter } from '../gtfs/GtfsAdapter';
import { VehiclesService } from '../gtfs/services/vehicles/VehiclesService';
import type { VehicleDetailEnricher } from '../gtfs/services/vehicles/VehicleDetailEnricher';
import { BaseGtfsAlertsMapper } from '../gtfs/services/alerts/BaseGtfsAlertsMapper';
import { KordisGtfsRtVehiclesService } from './services/vehicles/KordisGtfsRtVehiclesService';
import { KordisVehicleDetailEnricher } from './services/vehicles/KordisVehicleDetailEnricher';
import { KordisAlertsMapper } from './services/alerts/KordisAlertsMapper';

export class KordisAdapter extends GtfsAdapter {
    protected override createVehiclesService(): VehiclesService {
        return new KordisGtfsRtVehiclesService(this.city);
    }

    protected override createDetailEnricher(vehiclesService: VehiclesService): VehicleDetailEnricher {
        return new KordisVehicleDetailEnricher(vehiclesService);
    }

    protected override createAlertsMapper(): BaseGtfsAlertsMapper {
        return new KordisAlertsMapper();
    }
}
