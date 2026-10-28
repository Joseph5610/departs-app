/**
 * What the app and the server both know about each city: where it is, the zone its timetables are written in
 * and which features it has. Plain TypeScript without imports: both builds compile it.
 */

/** ISO 3166-1 alpha-2 codes of the countries the cities belong to. */
export const COUNTRY_CODES = ['CZ', 'SK'] as const;
export type CountryCode = typeof COUNTRY_CODES[number];

export interface CityFacts {
    slug: string;
    name: string;
    country: CountryCode;
    /** IANA zone the city's timetables are written in; times are shown and compared in it. */
    timezone: string;
    center: [number, number];
    /** [west, south, east, north] */
    bounds: [number, number, number, number];
    isBeta?: boolean;
    /** Kept out of the city lists; reachable by its URL and unlocked for a device with `?beta=<slug>`. */
    isHidden?: boolean;
    hasPointsOfSale?: boolean;
    /** Whether the city has a service-alerts source; the app hides the alerts UI otherwise. */
    hasAlerts?: boolean;
    /** The vehicle and stop modes offered as map filters, in display order. */
    filters: {
        vehicles: string[];
        stops: string[];
    };
}

export const CITY_FACTS = {
    prague: {
        slug: 'prague',
        name: 'Praha',
        country: 'CZ',
        timezone: 'Europe/Prague',
        center: [14.4212, 50.0875],
        bounds: [14.22, 49.94, 14.71, 50.18],
        hasPointsOfSale: true,
        hasAlerts: true,
        filters: {
            vehicles: ['metro', 'tram', 'bus', 'trolleybus', 'train', 'ferry', 'funicular'],
            stops: ['metro', 'train'],
        },
    },
    brno: {
        slug: 'brno',
        name: 'Brno',
        country: 'CZ',
        timezone: 'Europe/Prague',
        center: [16.6068, 49.1951],
        bounds: [16.44, 49.11, 16.77, 49.28],
        hasAlerts: true,
        isBeta: true,
        filters: {
            vehicles: ['tram', 'bus', 'trolleybus', 'train', 'ferry'],
            stops: [],
        },
    },
    presov: {
        slug: 'presov',
        name: 'Prešov',
        country: 'SK',
        timezone: 'Europe/Bratislava',
        center: [21.2393, 48.9985],
        bounds: [21.13, 48.93, 21.37, 49.08],
        isBeta: true,
        filters: {
            vehicles: ['bus', 'trolleybus'],
            stops: [],
        },
    },
    duk: {
        slug: 'duk',
        name: 'Ústecký kraj',
        country: 'CZ',
        timezone: 'Europe/Prague',
        center: [14.0322, 50.6607],
        bounds: [12.93, 50.11, 14.61, 51.05],
        isBeta: true,
        isHidden: true,
        filters: {
            vehicles: ['train', 'bus', 'trolleybus', 'tram', 'ferry'],
            stops: [],
        },
    },
} satisfies Record<string, CityFacts>;

export type CitySlug = keyof typeof CITY_FACTS;
