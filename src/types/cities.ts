export interface City {
    slug: string;
    name: string;
    /** ISO 3166-1 alpha-2 code, used to group cities in the switcher. */
    country: string;
    /** IANA zone the city's timetables are written in. */
    timezone?: string;
    center: [number, number];
    bounds: [number, number, number, number];
    isBeta?: boolean;
    /** Kept out of the city lists until a device unlocks it with `?beta=<slug>`. */
    isHidden?: boolean;
    hasPointsOfSale?: boolean;
    hasAlerts?: boolean;
    filters?: {
        vehicles: string[];
        stops: string[];
    };
}

/** Where a network has stops (departs-data `coverage.json`): stop counts per `x|y` grid cell of `cell` degrees. */
export interface NetworkCoverage {
    cell: number;
    cells: Record<string, number>;
}

export interface CitiesResponse {
    cities: City[];
}
