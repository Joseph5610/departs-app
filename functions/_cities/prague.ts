import type { CityConfig } from '../_core/city-config';
import type { City } from './types';
import { VehiclesService } from '../_domain/golemio/vehicles/VehiclesService';
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
    hasPointsOfSale: true,
    hasAlerts: true,
    virtualTableUrl: 'https://data.pid.cz/departures/?ids=',
    filters: {
        vehicles: ['metro', 'tram', 'bus', 'trolleybus', 'train', 'ferry', 'funicular'],
        stops: ['metro', 'train']
    }
};

/**
 * Prague (PID): every endpoint is served from Golemio's API rather than prebuilt GTFS files, so it
 * shares no use-cases with the GTFS cities - only their contract.
 */
export const city: City = {
    config,
    create: () => {
        const vehicles = new VehiclesService();
        const alerts = new AlertsService();
        return {
            vehicles,
            departures: new DeparturesService(),
            detail: new VehicleDetailService(),
            alerts,
            infotexts: new InfotextsService(),
            debugFeed: {
                getRawFeed: (ctx, type) => (type === 'alerts' ? alerts.getRawFeed(ctx.env) : vehicles.getRawVehicles(ctx.env)),
            },
        };
    },
};
