type AdapterType = 'golemio' | 'gtfs' | 'kordis' | 'duk';

export interface AdapterConfig {
    realtimeUrl?: string;
    staticDataUrl?: string;
    [key: string]: string | boolean | undefined;
}

export interface CityConfig {
    slug: string;
    name: string;
    timezone: string;
    center: [number, number];
    bounds: [number, number, number, number]; // [w, s, e, n]
    adapter: AdapterType;
    adapterConfig?: AdapterConfig;
    isBeta?: boolean;
    hasPointsOfSale?: boolean;
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
        timezone: 'Europe/Prague',
        center: [14.4212, 50.0875],
        bounds: [14.22, 49.94, 14.71, 50.18],
        adapter: 'golemio',
        hasPointsOfSale: true,
        virtualTableUrl: 'https://data.pid.cz/departures/?ids=',
        filters: {
            vehicles: ['metro', 'tram', 'bus', 'trolleybus', 'train', 'ferry', 'funicular'],
            stops: ['metro', 'train']
        }
    },
    brno: {
        slug: 'brno',
        name: 'Brno',
        timezone: 'Europe/Prague',
        center: [16.6068, 49.1951],
        bounds: [16.44, 49.11, 16.77, 49.28],
        adapter: 'kordis',
        adapterConfig: {
            realtimeUrl: 'https://kordis-jmk.cz/gtfs/gtfsReal.dat',
            staticDataUrl: 'https://data.departs.app'
        },
        isBeta: true,
        filters: {
            vehicles: ['tram', 'bus', 'trolleybus', 'train', 'ferry'],
            stops: []
        }
    },
    // duk: {
    //     slug: 'duk',
    //     name: 'Ústecký kraj',
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
