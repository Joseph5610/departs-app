import type { CityConfig } from '../_core/cityConfig';
import type { City } from './types';
import { gtfsUseCases } from '../_domain/gtfs/useCases';
import { GtfsRtVehicleSource } from '../_domain/gtfs/vehicles/GtfsRtVehicleSource';
import { KordisVehicleMapping } from '../_domain/kordis/index/KordisVehicleMapping';
import { createKordisAlertsMapper } from '../_domain/kordis/alerts/kordisAlertsMapper';

const config: CityConfig = {
    slug: 'brno',
    name: 'Brno',
    country: 'CZ',
    timezone: 'Europe/Prague',
    networkOperator: 'IDS JMK',
    center: [16.6068, 49.1951],
    bounds: [16.44, 49.11, 16.77, 49.28],
    feed: {
        realtimeUrl: 'https://kordis-jmk.cz/gtfs/gtfsReal.dat',
        hasTripAliases: true
    },
    hasAlerts: true,
    isBeta: true,
    filters: {
        vehicles: ['tram', 'bus', 'trolleybus', 'train', 'ferry'],
        stops: []
    }
};

/**
 * Brno (IDS JMK): the GTFS stack with KORDIS's own reading of its realtime feed - recycled trip ids,
 * vehicles repeated under several of them, and padded stop ids.
 */
export const city: City = {
    config,
    create: () => gtfsUseCases(config, {
        vehicleSource: new GtfsRtVehicleSource(config, new KordisVehicleMapping()),
        alertsMapper: createKordisAlertsMapper(),
    }),
};
