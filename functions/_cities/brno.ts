import type { CityConfig } from '../_core/city-config';
import type { City } from './types';
import { gtfsUseCases } from '../_domain/gtfs/use-cases';
import { GtfsRtVehicleSource } from '../_domain/gtfs/vehicles/gtfs-rt-vehicle-source';
import { KordisVehicleMapping } from '../_domain/kordis/index/vehicle-mapping';
import { createKordisVehicleDetailEnricher } from '../_domain/kordis/vehicles/kordis-detail-enricher';
import { createKordisAlertsMapper } from '../_domain/kordis/alerts/kordis-alerts-mapper';

const config: CityConfig = {
    slug: 'brno',
    name: 'Brno',
    country: 'CZ',
    timezone: 'Europe/Prague',
    center: [16.6068, 49.1951],
    bounds: [16.44, 49.11, 16.77, 49.28],
    feed: {
        realtimeUrl: 'https://kordis-jmk.cz/gtfs/gtfsReal.dat',
        staticDataUrl: 'https://data.departs.app',
        hasTripAliases: true,
        vehicleMetadataFile: 'dpmb-vehicles.json?v=2'
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
 * vehicles repeated under several of them, and DPMB fleet metadata on the detail.
 */
export const city: City = {
    config,
    create: () => gtfsUseCases(config, {
        vehicleSource: new GtfsRtVehicleSource(config, new KordisVehicleMapping()),
        enricher: createKordisVehicleDetailEnricher,
        alertsMapper: createKordisAlertsMapper(),
    }),
};
