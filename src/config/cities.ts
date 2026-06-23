export interface InitialCityConfig {
    slug: string;
    center: [number, number];
    bounds: [number, number, number, number];
}

export const FRONTEND_CITIES_CONFIG: Record<string, InitialCityConfig> = {
    prague: {
        slug: 'prague',
        center: [14.4212, 50.0875],
        bounds: [14.22, 49.94, 14.71, 50.18],
    },
    brno: {
        slug: 'brno',
        center: [16.6068, 49.1951],
        bounds: [16.44, 49.11, 16.77, 49.28],
    },
};

export const FALLBACK_CITY_CONFIG = FRONTEND_CITIES_CONFIG['prague'];
