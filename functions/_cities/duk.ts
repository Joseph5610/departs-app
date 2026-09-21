import type { CityConfig } from '../_core/city-config';
import type { City } from './types';
import { gtfsUseCases } from '../_domain/gtfs/use-cases';
import { noAlerts } from '../_domain/use-cases';
import { DukVehicleSource } from '../_domain/duk/vehicles/DukVehicleSource';
import { DukVehicleDetail } from '../_domain/duk/vehicles/DukVehicleDetail';
import { DukDeparturesService } from '../_domain/duk/departures/DukDeparturesService';
import { getDukTrafficFeed } from '../_feeds/duk/duk-traffic-feed';

const config: CityConfig = {
    slug: 'duk',
    name: 'Ústecký kraj',
    country: 'CZ',
    timezone: 'Europe/Prague',
    center: [14.0322, 50.6607],
    bounds: [12.93, 50.11, 14.61, 51.05],
    feed: {
        baseUrl: 'https://tabule.portabo.cz/api/v1-tabule/cis',
        staticDataUrl: 'https://data.departs.app'
    },
    isBeta: true,
    isHidden: true,
    filters: {
        vehicles: ['train', 'bus', 'trolleybus', 'tram', 'ferry'],
        stops: []
    }
};

/**
 * Ústecký kraj (DÚK): static data built from the national JDF export and served like Brno, with
 * realtime positions from the Portabo `/cis` traffic feed, which covers both regional (DÚK) and
 * city (MHD) vehicles. The feed carries no service alerts.
 */
export const city: City = {
    config,
    create: () => gtfsUseCases(config, {
        vehicleSource: new DukVehicleSource(config),
        departures: (vehicles) => new DukDeparturesService(config, vehicles),
        detail: (timetable, vehicles) => new DukVehicleDetail(config, timetable, vehicles),
        alerts: noAlerts,
        debugFeed: {
            getRawFeed: async (_ctx, type) => (type === 'alerts' ? [] : getDukTrafficFeed(config)),
        },
    }),
};
