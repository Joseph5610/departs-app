import type { CityConfig } from '../_core/cityConfig';
import { CITY_FACTS } from '../../shared/cities';
import type { City } from './types';
import { gtfsUseCases } from '../_domain/gtfs/useCases';
import { noAlerts } from '../_domain/useCases';
import { DukVehicleSource } from '../_domain/duk/vehicles/DukVehicleSource';
import { DukVehicleDetail } from '../_domain/duk/vehicles/DukVehicleDetail';
import { DukDeparturesService } from '../_domain/duk/departures/DukDeparturesService';
import { getDukTrafficFeed } from '../_feeds/duk/dukTrafficFeed';

const config: CityConfig = {
    ...CITY_FACTS.duk,
    feed: {
        baseUrl: 'https://tabule.portabo.cz/api/v1-tabule/cis',
    },
    networkOperator: 'Doprava Ústeckého kraje'
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
