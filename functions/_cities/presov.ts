import type { CityConfig } from '../_core/city-config';
import type { City } from './types';
import { gtfsUseCases } from '../_domain/gtfs/use-cases';
import { noAlerts } from '../_domain/use-cases';
import { DpmpVehicleSource } from '../_domain/dpmp/vehicles/DpmpVehicleSource';
import { getDpmpCsvFeed } from '../_feeds/dpmp/dpmp-csv-feed';

const config: CityConfig = {
    slug: 'presov',
    name: 'Prešov',
    country: 'SK',
    timezone: 'Europe/Bratislava',
    center: [21.2393, 48.9985],
    bounds: [21.13, 48.93, 21.37, 49.08],
    feed: {
        realtimeUrl: 'https://egov.presov.sk/geodatakatalog/dpmp.csv',
        staticDataUrl: 'https://data.departs.app',
        vehicleMetadataFile: 'dpmp-vehicles.json'
    },
    isBeta: true,
    filters: {
        vehicles: ['bus', 'trolleybus'],
        stops: []
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
