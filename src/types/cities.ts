export interface City {
    slug: string;
    name: string;
    /** ISO 3166-1 alpha-2 code, used to group cities in the switcher. */
    country: string;
    center: [number, number];
    bounds: [number, number, number, number];
    isBeta?: boolean;
    /** Kept out of the city lists until a device unlocks it with `?beta=<slug>`. */
    isHidden?: boolean;
    hasPointsOfSale?: boolean;
    hasAlerts?: boolean;
    virtualTableUrl?: string;
    filters?: {
        vehicles: string[];
        stops: string[];
    };
}

export interface CitiesResponse {
    cities: City[];
}
