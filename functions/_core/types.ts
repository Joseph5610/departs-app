import type { Fetcher, KVNamespace } from "@cloudflare/workers-types";

export interface Env {
    ASSETS: Fetcher;
    FEEDBACK_STORE: KVNamespace;
    // Secrets are typed as possibly-undefined: a missing binding is a runtime reality, not a type error.
    GOLEMIO_API_KEY: string | undefined;
    TURNSTILE_SECRET_KEY: string | undefined;
    /**
     * Local dev only, bound by `npm run dev`: the DPMP CSV via the Vite relay, since local workerd
     * rejects the upstream's legacy TLS. Not in `.dev.vars`: `[secrets] required` filters it out there.
     */
    DPMP_REALTIME_URL?: string;
}

/**
 * What a city use-case actually reads off a request: the query, the bindings, and a way to run work
 * past the response. Callers with a real Cloudflare `EventContext` derive this from `request.url`;
 * MCP builds one directly, with no `Request` object to fake.
 */
export interface CityRequestContext {
    url: URL;
    env: Env;
    waitUntil: (promise: Promise<unknown>) => void;
}

// --- Application Internal Types (Response Structures) ---
export interface AppVehicleDescriptor {
    operator?: string;
    vehicle_type?: string;
    is_wheelchair_accessible?: boolean | null;
    is_air_conditioned?: boolean | null;
    has_usb_chargers?: boolean | null;
    vehicle_registration_number?: string | number;
}

export type AppRouteType = 'tram' | 'metro' | 'train' | 'bus' | 'ferry' | 'funicular' | 'trolleybus' | 'unknown';

export type AppVehicleState = 
    | 'at_stop' 
    | 'before_track' 
    | 'before_track_delayed' 
    | 'canceled' 
    | 'off_track' 
    | 'on_track'
    | 'unknown';

export interface AppStopTimeProperties {
    stop_id: string;
    stop_name: string;
    stop_sequence: number;
    arrival_time: string;
    departure_time: string;
    realtime_arrival_time?: string;
    realtime_departure_time?: string;
    zone_id?: string;
    is_wheelchair_accessible?: boolean | null;
    shape_dist_traveled?: number;
    is_request_stop?: boolean;
    connections?: AppStopConnection[];
    continues_as?: AppContinuation;
}

/** The trip the same vehicle continues as; ids are absent when only the line is known. */
export interface AppContinuation {
    trip_id?: string;
    vehicle_id?: string;
    line: string;
    route_color?: string;
    type: AppRouteType;
    headsign: string;
    departure_time?: string;
}

/** An onward trip scheduled to wait at this stop for the trip being viewed. */
export interface AppStopConnection {
    trip_id: string;
    vehicle_id?: string;
    line: string;
    route_color?: string;
    type: AppRouteType;
    headsign: string;
    /** Scheduled departure, `HH:MM:SS` like the stop times. */
    departure_time: string;
    delay: number | null;
    max_wait_s: number;
    /** The viewed trip's current delay exceeds what the connection waits for. */
    at_risk: boolean;
}

/** An arriving trip that a departure is scheduled to wait for. */
export interface AppDepartureFeeder {
    line: string;
    route_color?: string;
    type: AppRouteType;
    max_wait_s: number;
    /** Expected hold beyond the scheduled departure; null without live data for the feeder. */
    hold_s: number | null;
    /** The feeder is late enough that the departure will not wait for it. */
    will_miss: boolean;
}

export interface AppStopProperties {
    stop_id: string;
    stop_name: string;
    platform_code?: string | null;
    location_type: number | string;
    parent_station: string | null;
    zone_id: string | null;
    is_centroid?: boolean;
    is_drop_off_only?: boolean;
    is_train?: number;
    metro_a?: number;
    metro_b?: number;
    metro_c?: number;
    metro_lines?: Array<{ name: string; route_color: string }>;
    metro_color?: string;
    metro_color_2?: string;
    all_ids?: string[];
    lines?: Array<{
        name: string;
        type: AppRouteType;
        route_color: string;
    }>;
}

export interface AppStopFeature {
    type: 'Feature';
    id?: string | number;
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
    properties: AppStopProperties;
}

export interface AppStopCollection {
    type: 'FeatureCollection';
    features: AppStopFeature[];
}

export interface AppVehicleCollection {
    type: 'FeatureCollection';
    features: AppVehicleFeature[];
    status?: 'ok' | 'stale' | 'upstream_offline';
    last_updated?: string;
}

export interface AppVehicleProperties {
    vehicle_id?: string | null;
    gtfs_trip_id: string;
    route_short_name: string;
    route_type: AppRouteType;
    trip_headsign?: string;
    bearing: number | null;
    delay: number | null;
    state_position?: AppVehicleState;
    last_stop_sequence?: number | null;
    origin_timestamp?: string;
    run_number?: string | number;
    vehicle_descriptor?: AppVehicleDescriptor;
    is_static_fallback?: boolean;
    route_color: string;
    shape_dist_traveled?: number;
}

export interface AppVehicleFeature {
    type: 'Feature';
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    } | null;
    properties: AppVehicleProperties;
}

export interface AppVehicleDetail extends AppVehicleProperties {
    geometry?: {
        type: 'Point';
        coordinates: [number, number];
    } | null;
    stop_times?: {
        features: Array<{
            type: 'Feature';
            properties: AppStopTimeProperties;
            geometry?: {
                type: string;
                coordinates: number[] | number[][];
            };
        }>;
    };
    route_geojson?: AppRouteGeoJSON;
}

export interface AppRouteFeature {
    type: 'Feature';
    geometry: {
        type: 'LineString' | 'Point';
        coordinates: number[] | number[][] | [number, number][];
    };
    properties: {
        route_color: string;
        is_terminal?: boolean;
        [key: string]: unknown;
    };
}

export interface AppRouteGeoJSON {
    type: 'FeatureCollection';
    features: AppRouteFeature[];
}

export interface AppDeparture {
    timestamp: string;
    scheduled: string;
    delay: number | null;
    line: string;
    type: AppRouteType;
    directionId: string;
    headsign: string;
    isCanceled: boolean;
    tripId?: string;
    vehicleId?: string;
    platform?: string;
    route_color?: string;
    is_wheelchair_accessible?: boolean | null;
    is_air_conditioned?: boolean | null;
    stopId?: string;
    is_request_stop?: boolean;
    connections?: AppDepartureFeeder[];
    continues_as?: AppContinuation;
}

export interface AppDepartureResponse {
    departures: AppDeparture[];
}

export interface AppAlert {
    type: 'incident' | 'exclusion';
    title: string;
    description: string | null;
    link: string;
    /** ISO 8601 instant. */
    valid_from: string | null;
    /** ISO 8601 instant. */
    valid_to: string | null;
    guid?: string;
    priority?: string;
    lines?: string[];
    line_metadata?: Array<{ name: string; route_color: string; type: AppRouteType }>;
    isActive?: boolean;
    isFuture?: boolean;
    cause?: string;
    causeDetail?: { cs?: string; en?: string };
    effect?: string;
}

export interface AppInfotext {
    id: string;
    text: string;
    textEn: string | null;
    priority: 'low' | 'normal' | 'high';
    displayType: 'inline' | 'general';
    relatedStopIds: string[];
    /** ISO 8601 instant. */
    valid_from: string;
    /** ISO 8601 instant. */
    valid_to: string | null;
}

export interface AppAlertsResponse {
    alerts: AppAlert[];
}

export interface AppCity {
    slug: string;
    name: string;
    /** ISO 3166-1 alpha-2 code, used to group cities in the switcher. */
    country: string;
    center: [number, number];
    bounds: [number, number, number, number];
    isBeta?: boolean;
    isHidden?: boolean;
    hasPointsOfSale?: boolean;
    hasAlerts?: boolean;
    virtualTableUrl?: string;
    filters?: {
        vehicles: string[];
        stops: string[];
    };
}

export interface AppCitiesResponse {
    cities: AppCity[];
}
