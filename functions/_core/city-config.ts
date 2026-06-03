export type AdapterType = 'golemio';

export interface CityConfig {
    slug: string;
    name: string;
    timezone: string;
    center: [number, number];
    bounds: [number, number, number, number]; // [w, s, e, n]
    adapter: AdapterType;
}

export const CITY_REGISTRY: Record<string, CityConfig> = {
    prague: {
        slug: 'prague',
        name: 'Praha',
        timezone: 'Europe/Prague',
        center: [14.4212, 50.0875],
        bounds: [14.22, 49.94, 14.71, 50.18],
        adapter: 'golemio',
    },
};

export function getCityConfig(slug: string): CityConfig | null {
    return CITY_REGISTRY[slug] ?? null;
}
