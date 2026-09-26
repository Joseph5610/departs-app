/** ISO 3166-1 alpha-2 code of the country a city belongs to. */
type CountryCode = 'CZ' | 'SK';

interface FeedConfig {
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
    feed?: FeedConfig;
    isBeta?: boolean;
    /** Kept out of the city lists; reachable by its URL and unlocked for a device with `?beta=<slug>`. */
    isHidden?: boolean;
    hasPointsOfSale?: boolean;
    /** Whether the city has a service-alerts source; the frontend hides the alerts UI otherwise. */
    hasAlerts?: boolean;
    virtualTableUrl?: string;
    filters?: {
        vehicles: string[];
        stops: string[];
    };
}
