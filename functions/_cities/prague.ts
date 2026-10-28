import type { CityConfig } from '../_core/cityConfig';
import { CITY_FACTS } from '../../shared/cities';
import type { City } from './types';
import { VehiclesService } from '../_domain/vehicles/VehiclesService';
import { EdgeFleetSource } from '../_domain/vehicles/EdgeFleetSource';
import { GolemioVehicles } from '../_domain/golemio/vehicles/GolemioVehicles';
import { GolemioVehicleDetailService } from '../_domain/golemio/vehicles/GolemioVehicleDetailService';
import { GolemioDeparturesService } from '../_domain/golemio/departures/GolemioDeparturesService';
import { GolemioAlertsService } from '../_domain/golemio/alerts/GolemioAlertsService';
import { InfotextsService } from '../_domain/golemio/infotexts/InfotextsService';

const config: CityConfig = {
    ...CITY_FACTS.prague,
    networkOperator: 'PID'
};

/**
 * Prague (PID): every endpoint is served from Golemio's API rather than prebuilt GTFS files. Vehicles go
 * through the shared fleet cache and `VehiclesService` like every city's; the rest is Golemio's own.
 */
export const city: City = {
    config,
    create: (env) => {
        const network = new GolemioVehicles(env);
        const vehicles = new VehiclesService(config, new EdgeFleetSource('golemio_prague', network));
        const alerts = new GolemioAlertsService(config);
        return {
            vehicles,
            departures: new GolemioDeparturesService(),
            detail: new GolemioVehicleDetailService(vehicles),
            alerts,
            infotexts: new InfotextsService(),
            debugFeed: {
                getRawFeed: (ctx, type) => (type === 'alerts' ? alerts.getRawFeed(ctx.env) : network.rawPayload()),
            },
        };
    },
};
