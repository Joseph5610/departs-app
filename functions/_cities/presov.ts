import type { CityConfig } from '../_core/cityConfig';
import { CITY_FACTS } from '../../shared/cities';
import type { City } from './types';
import { gtfsUseCases } from '../_domain/gtfs/useCases';
import { noAlerts } from '../_domain/useCases';
import { DpmpVehicleSource } from '../_domain/dpmp/vehicles/DpmpVehicleSource';
import { getDpmpCsvFeed } from '../_feeds/dpmp/dpmpCsvFeed';

const config: CityConfig = {
    ...CITY_FACTS.presov,
    networkOperator: 'DPMP',
    feed: {
        realtimeUrl: 'https://egov.presov.sk/geodatakatalog/dpmp.csv',
    }
};

/**
 * Prešov (DPMP): static GTFS served like Brno, with realtime positions from DPMP's CSV export
 * instead of a GTFS-RT feed. The export carries no service alerts.
 */
export const city: City = {
    config,
    create: (env) => gtfsUseCases(config, {
        vehicleSource: new DpmpVehicleSource(config, env.DPMP_REALTIME_URL),
        alerts: noAlerts,
        debugFeed: {
            getRawFeed: async (_ctx, type) => (type === 'alerts' ? [] : getDpmpCsvFeed(config, env.DPMP_REALTIME_URL)),
        },
    }),
};
