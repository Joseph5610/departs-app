type AdapterType = 'golemio' | 'gtfs' | 'kordis' | 'duk' | 'dpmp';

/** ISO 3166-1 alpha-2 code of the country a city belongs to. */
type CountryCode = 'CZ' | 'SK';

export interface AdapterConfig {
    realtimeUrl?: string;
    staticDataUrl?: string;
    hasTripAliases?: boolean;
    /** Fleet metadata ranges under `${staticDataUrl}/${slug}/`, matched by vehicle number. */
    vehicleMetadataFile?: string;
    [key: string]: string | boolean | undefined;
}

export interface CityConfig {
    slug: string;
    name: string;
    country: CountryCode;
    timezone: string;
    center: [number, number];
    bounds: [number, number, number, number]; // [w, s, e, n]
    adapter: AdapterType;
    adapterConfig?: AdapterConfig;
    isBeta?: boolean;
    hasPointsOfSale?: boolean;
    /** Whether the adapter has a service-alerts source; the frontend hides the alerts UI otherwise. */
    hasAlerts?: boolean;
    virtualTableUrl?: string;
    filters?: {
        vehicles: string[];
        stops: string[];
    };
}

export const CITY_REGISTRY: Record<string, CityConfig> = {
    prague: {
        slug: 'prague',
        name: 'Praha',
        country: 'CZ',
        timezone: 'Europe/Prague',
        center: [14.4212, 50.0875],
        bounds: [14.22, 49.94, 14.71, 50.18],
        adapter: 'golemio',
        hasPointsOfSale: true,
        hasAlerts: true,
        virtualTableUrl: 'https://data.pid.cz/departures/?ids=',
        filters: {
            vehicles: ['metro', 'tram', 'bus', 'trolleybus', 'train', 'ferry', 'funicular'],
            stops: ['metro', 'train']
        }
    },
    brno: {
        slug: 'brno',
        name: 'Brno',
        country: 'CZ',
        timezone: 'Europe/Prague',
        center: [16.6068, 49.1951],
        bounds: [16.44, 49.11, 16.77, 49.28],
        adapter: 'kordis',
        adapterConfig: {
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
    },
    presov: {
        slug: 'presov',
        name: 'Prešov',
        country: 'SK',
        timezone: 'Europe/Bratislava',
        center: [21.2393, 48.9985],
        bounds: [21.13, 48.93, 21.37, 49.08],
        adapter: 'dpmp',
        adapterConfig: {
            realtimeUrl: 'https://egov.presov.sk/geodatakatalog/dpmp.csv',
            staticDataUrl: 'https://data.departs.app',
            vehicleMetadataFile: 'dpmp-vehicles.json'
        },
        isBeta: true,
        filters: {
            vehicles: ['bus', 'trolleybus'],
            stops: []
        }
    },
    // duk: {
    //     slug: 'duk',
    //     name: 'Ústecký kraj',
    //     country: 'CZ',
    //     timezone: 'Europe/Prague',
    //     center: [14.0322, 50.6607],
    //     bounds: [12.93, 50.11, 14.61, 51.05],
    //     adapter: 'duk',
    //     adapterConfig: {
    //         baseUrl: 'https://tabule.portabo.cz/api/v1-tabule/cis'
    //     },
    //     isBeta: true,
    //     filters: {
    //         vehicles: ['train', 'bus', 'trolleybus', 'tram', 'ferry'],
    //         stops: []
    //     }
    // },
};

export function getCityConfig(slug: string): CityConfig | null {
    return CITY_REGISTRY[slug] ?? null;
}
