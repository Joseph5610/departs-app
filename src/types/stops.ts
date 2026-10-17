import type { RouteType } from './vehicles';

export interface StopProperties {
    stop_id: string;
    stop_name: string;
    platform_code?: string;
    location_type: number;
    zone_id?: string;
    is_station?: boolean;
    /** Set on a stop of a neighbouring network shown beside the selected city's. */
    city_slug?: string;
    is_drop_off_only?: boolean;
    /** PID `stop_icons` codes of the modes a rider can change to here (`Ma`, `Ra`, `Ap`, ...). */
    interchanges?: string[];
    all_ids?: string[];
    /** A station's number of platforms (its `all_ids` also hold their aliases). */
    platform_count?: number;
    lines?: Array<{ name: string; type: RouteType; route_color: string }>;
    /** Tiles of the stop's map badge (`metro/B/F8B322|tram|bus`), see `stopBadgeTiles`; set for the map. */
    badges?: string;
    /** Rank of the stop's leading mode in ROUTE_TYPE_ORDER; the map places lower ranks first. */
    mode_rank?: number;
    /** A platform without a code: the stop most of its trips call at next, from departs-data. */
    direction?: string;
}

export interface StopFeature {
    type: "Feature";
    geometry: {
        type: "Point";
        coordinates: [number, number];
    };
    properties: StopProperties;
}

export interface StopCollection {
    type: "FeatureCollection";
    features: StopFeature[];
}

export interface SelectedStop extends Partial<StopProperties> {
    stop_id: string;
    coordinates?: [number, number];
}

/** `<city>/stops.json` on the static data CDN (departs-data `StopsFile`); `pos` is `[lon, lat]`. */
export interface StopsFile {
    version: 1;
    stations: StopsFileStation[];
    platforms: StopsFilePlatform[];
    entrances: StopsFileEntrance[];
}

export interface StopsFileStation {
    id: string;
    name: string;
    pos: [number, number];
}

export interface StopsFilePlatform {
    id: string;
    /** Further ids the network uses for this same platform (PID `U1000Z1P` beside `U1000Z1`). */
    aliases?: string[];
    station: string;
    pos: [number, number];
    code?: string;
    direction?: string;
    zones?: string[];
    /** Keys into the city's `routes.json`. */
    routes: string[];
    alightOnly?: true;
    interchanges?: string[];
}

export interface StopsFileEntrance {
    id: string;
    station: string;
    name: string;
    pos: [number, number];
}
