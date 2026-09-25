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
    type: AppRouteType;
    headsign: string;
    departure_time?: string;
}

/** An onward trip scheduled to wait at this stop for the trip being viewed. */
export interface AppStopConnection {
    trip_id: string;
    vehicle_id?: string;
    line: string;
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
    type: AppRouteType;
    /** Join key for the frontend's own live delay lookup - the feeder's actual `hold_s`/`will_miss` are computed there. */
    trip_id: string;
    /** Hold this departure would need if the feeder arrives exactly on schedule; add the feeder's live delay for the real expected hold. */
    base_hold_s: number;
    max_wait_s: number;
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
    /**
     * One entry per affected route, all unresolved - name/type/color resolution happens on the
     * frontend from its own routes.json join. GTFS-RT-sourced alerts (KORDIS/PID) send `route_id`,
     * exactly what the feed gives (numeric for KORDIS, the real routes.json key for PID). RSS-sourced
     * exclusions carry no route id at all, so they send `name` only - the frontend resolves type/color
     * the same way, keyed by name instead of id.
     */
    line_metadata?: Array<{ route_id?: string; name?: string }>;
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
