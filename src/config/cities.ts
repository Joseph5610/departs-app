export interface InitialCityConfig {
    slug: string;
    center: [number, number];
    bounds: [number, number, number, number];
    filters?: {
        vehicles: string[];
        stops: string[];
    };
}

export const FRONTEND_CITIES_CONFIG: Record<string, InitialCityConfig> = {
    prague: {
        slug: 'prague',
        center: [14.4212, 50.0875],
        bounds: [14.22, 49.94, 14.71, 50.18],
        filters: {
            vehicles: ['metro', 'tram', 'bus', 'trolleybus', 'train', 'ferry', 'funicular'],
            stops: ['metro', 'train']
        }
    },
    brno: {
        slug: 'brno',
        center: [16.6068, 49.1951],
        bounds: [16.44, 49.11, 16.77, 49.28],
        filters: {
            vehicles: ['tram', 'bus', 'trolleybus', 'train', 'ferry'],
            stops: []
        }
    },
};

export const FALLBACK_CITY_CONFIG = FRONTEND_CITIES_CONFIG['prague'];
