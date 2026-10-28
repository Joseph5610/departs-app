import type { CityConfig } from '../_core/cityConfig';
import { CITY_FACTS } from '../../shared/cities';
import type { City } from './types';
import { gtfsUseCases } from '../_domain/gtfs/useCases';
import { GtfsRtVehicleSource } from '../_domain/gtfs/vehicles/GtfsRtVehicleSource';
import { KordisVehicleMapping } from '../_domain/kordis/index/KordisVehicleMapping';
import { createKordisAlertsMapper } from '../_domain/kordis/alerts/kordisAlertsMapper';
import { KordisAlertsService } from '../_domain/kordis/alerts/KordisAlertsService';
import { AlertsService } from '../_domain/gtfs/alerts/AlertsService';

const config: CityConfig = {
    ...CITY_FACTS.brno,
    networkOperator: 'IDS JMK',
    feed: {
        realtimeUrl: 'https://kordis-jmk.cz/gtfs/gtfsReal.dat',
        hasTripAliases: true
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
        alerts: new KordisAlertsService(new AlertsService(config, createKordisAlertsMapper()), config.timezone),
    }),
};
