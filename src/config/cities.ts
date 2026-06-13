import type { AppCity } from '../../functions/_core/types';

export const FRONTEND_CITIES_CONFIG: Record<string, AppCity> = {
    prague: {
        slug: 'prague',
        name: 'Praha',
        center: [14.4212, 50.0875],
        bounds: [14.22, 49.94, 14.71, 50.18],
        adapter: 'golemio',
    },
    brno: {
        slug: 'brno',
        name: 'Brno',
        center: [16.6068, 49.1951],
        bounds: [16.44, 49.11, 16.77, 49.28],
        adapter: 'gtfs',
        isBeta: true,
    },
};

export const FALLBACK_CITY_CONFIG = FRONTEND_CITIES_CONFIG['prague'];
