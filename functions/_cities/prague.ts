import type { CityConfig } from '../_core/cityConfig';
import type { City } from './types';
import { VehiclesService } from '../_domain/vehicles/VehiclesService';
import { EdgeFleetSource } from '../_domain/vehicles/EdgeFleetSource';
import { GolemioVehicles } from '../_domain/golemio/vehicles/GolemioVehicles';
import { GolemioVehicleDetailService } from '../_domain/golemio/vehicles/GolemioVehicleDetailService';
import { GolemioDeparturesService } from '../_domain/golemio/departures/GolemioDeparturesService';
import { GolemioAlertsService } from '../_domain/golemio/alerts/GolemioAlertsService';
import { InfotextsService } from '../_domain/golemio/infotexts/InfotextsService';

const config: CityConfig = {
    slug: 'prague',
    name: 'Praha',
    country: 'CZ',
    timezone: 'Europe/Prague',
    center: [14.4212, 50.0875],
    bounds: [14.22, 49.94, 14.71, 50.18],
    networkOperator: 'PID',
    hasPointsOfSale: true,
    hasAlerts: true,
    filters: {
        vehicles: ['metro', 'tram', 'bus', 'trolleybus', 'train', 'ferry', 'funicular'],
        stops: ['metro', 'train']
    }
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
        const alerts = new GolemioAlertsService();
        return {
            vehicles,
            departures: new GolemioDeparturesService(),
            detail: new GolemioVehicleDetailService(),
            alerts,
            infotexts: new InfotextsService(),
            debugFeed: {
                getRawFeed: (ctx, type) => (type === 'alerts' ? alerts.getRawFeed(ctx.env) : network.rawPayload()),
            },
        };
    },
};
