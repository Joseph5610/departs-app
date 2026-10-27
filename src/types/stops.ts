import type { RouteType } from './vehicles';

/** A line serving a stop, branded from the city's `routes.json`. */
export interface StopLine {
    name: string;
    type: RouteType;
    route_color: string;
    /** A night line (`RouteInfo.night`). */
    night?: true;
}

/** A station: the place riders know by name, made of its platforms. */
export interface Station {
    kind: 'station';
    id: string;
    name: string;
    pos: [number, number];
    platforms: Platform[];
    /** Its platforms' lines, each once. */
    lines: StopLine[];
    /** Every platform is alight-only, so it has no departures to open. */
    alightOnly?: true;
    /** Set on a stop of a neighbouring network shown beside the selected city's. */
    city?: string;
}

/** A platform (pole, track) departures leave from; named after its station. */
export interface Platform {
    kind: 'platform';
    id: string;
    /** Further ids the network uses for this same platform; they resolve to it but never name it. */
    aliases?: string[];
    station: string;
    name: string;
    pos: [number, number];
    code?: string;
    /** For a platform without a code: the stop most of its trips call at next. */
    direction?: string;
    lines: StopLine[];
    alightOnly?: true;
    /** PID `stop_icons` codes of the modes a rider can change to here (`Ma`, `Ra`, `Ap`, ...). */
    interchanges?: string[];
    city?: string;
}

export interface Entrance {
    kind: 'entrance';
    id: string;
    station: string;
    name: string;
    pos: [number, number];
}

/** A stop a board can open. */
export type Stop = Station | Platform;

/** A city's stops as `stops.json` relates them, with every id and alias resolving to its stop. */
export interface StopModel {
    stations: Station[];
    platforms: Platform[];
    entrances: Entrance[];
    byId: ReadonlyMap<string, Stop>;
    /** Stations by their own id, which a platform's id or alias never shadows (unlike `byId`). */
    stationsById: ReadonlyMap<string, Station>;
    /** Set on a neighbouring network's stops shown beside the selected city's. */
    city?: string;
}

/**
 * What a board shows for an id: a station, a platform, or a section (several platforms of one station,
 * named by their comma-joined ids). `id` is the canonical one links and favorites use.
 */
export interface BoardStop {
    kind: 'station' | 'platform' | 'section';
    id: string;
    name: string;
    pos: [number, number];
    lines: StopLine[];
    /** The platforms whose departures it shows. */
    platforms: Platform[];
    /** The platform's code; on a section, its platforms' shared code. */
    code?: string;
    /** The stop itself, absent for a section. */
    stop?: Stop;
}

/** The stop a URL id opens. */
export interface SelectedStop {
    /** The id as the URL gives it. */
    id: string;
    /** What it names; null until the stop list has loaded, or when it names no stop the list knows. */
    board: BoardStop | null;
    /** The `stopId` its departures are requested by; null while that cannot be told yet. */
    departuresId: string | null;
}

/** A stop as the map draws it: one GeoJSON point with only what its layers read. */
export interface MapStopFeature {
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: {
        stop_id: string;
        stop_name: string;
        kind: 'station' | 'platform' | 'entrance';
        /** Tiles of the stop's map badge (`metro/B/F8B322|tram|bus`), see `stopBadgeTiles`. */
        badges?: string;
        /** A platform's code, drawn in a circle beside its badge. */
        platform_code?: string;
        /** Rank of the stop's leading mode in ROUTE_TYPE_ORDER; the map places lower ranks first. */
        mode_rank?: number;
        /** The network of a neighbouring city's stop. */
        city_slug?: string;
    };
}

export interface MapStopCollection {
    type: 'FeatureCollection';
    features: MapStopFeature[];
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
