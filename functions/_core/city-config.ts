type AdapterType = 'golemio' | 'gtfs';

export interface CityConfig {
    slug: string;
    name: string;
    timezone: string;
    center: [number, number];
    bounds: [number, number, number, number]; // [w, s, e, n]
    adapter: AdapterType;
    adapterConfig?: Record<string, string>;
    isBeta?: boolean;
    virtualTableUrl?: string;
}

export const CITY_REGISTRY: Record<string, CityConfig> = {
    prague: {
        slug: 'prague',
        name: 'Praha',
        timezone: 'Europe/Prague',
        center: [14.4212, 50.0875],
        bounds: [14.22, 49.94, 14.71, 50.18],
        adapter: 'golemio',
        virtualTableUrl: 'https://data.pid.cz/departures/?ids=',
    },
    // brno: {
    //     slug: 'brno',
    //     name: 'Brno',
    //     timezone: 'Europe/Prague',
    //     center: [16.6068, 49.1951],
    //     bounds: [16.44, 49.11, 16.77, 49.28],
    //     adapter: 'gtfs',
    //     adapterConfig: {
    //         stopsFile: 'cities/brno/stops.json',
    //         realtimeUrl: 'https://kordis-jmk.cz/gtfs/gtfsReal.dat',
    //         staticDataUrl: 'https://data.departs.app'
    //     },
    //     isBeta: true,
    // },
};

export function getCityConfig(slug: string): CityConfig | null {
    return CITY_REGISTRY[slug] ?? null;
}
