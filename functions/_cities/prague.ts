import type { CityConfig } from '../_core/city-config';
import type { City } from './types';
import { VehiclesService } from '../_domain/vehicles/VehiclesService';
import { EdgeFleetSource } from '../_domain/vehicles/edge-fleet-source';
import { GolemioVehicles } from '../_domain/golemio/vehicles/GolemioVehicles';
import { VehicleDetailService } from '../_domain/golemio/vehicles/VehicleDetailService';
import { DeparturesService } from '../_domain/golemio/departures/DeparturesService';
import { AlertsService } from '../_domain/golemio/alerts/AlertsService';
import { InfotextsService } from '../_domain/golemio/infotexts/InfotextsService';

const config: CityConfig = {
    slug: 'prague',
    name: 'Praha',
    country: 'CZ',
    timezone: 'Europe/Prague',
    center: [14.4212, 50.0875],
    bounds: [14.22, 49.94, 14.71, 50.18],
    feed: {
        staticDataUrl: 'https://data.departs.app'
    },
    networkOperator: 'PID',
    hasPointsOfSale: true,
    hasAlerts: true,
    virtualTableUrl: 'https://data.pid.cz/departures/?ids=',
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
        const alerts = new AlertsService();
        return {
            vehicles,
            departures: new DeparturesService(),
            detail: new VehicleDetailService(),
            alerts,
            infotexts: new InfotextsService(),
            debugFeed: {
                getRawFeed: (ctx, type) => (type === 'alerts' ? alerts.getRawFeed(ctx.env) : network.rawPayload()),
            },
        };
    },
};
