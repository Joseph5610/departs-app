/**
 * The JSON the API answers with, as the server builds it and the app reads it. The app extends these
 * with what it derives (colours, resolved lines, timing); the wire shape itself is defined only here.
 * Plain TypeScript importing only its own files: both builds compile it.
 */
import type { CityFacts } from './cities';

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

/**
 * The trip the same vehicle continues as; ids are absent when only the line is known.
 * GTFS sends `route_id` raw for the frontend to resolve `type`; Golemio resolves both at build time.
 */
export interface AppContinuation {
    trip_id?: string;
    vehicle_id?: string;
    route_id?: string;
    line: string;
    type?: AppRouteType;
    headsign: string;
    departure_time?: string;
}

/**
 * An onward trip scheduled to wait at this stop for the trip being viewed.
 * GTFS sends `route_id` raw for the frontend to resolve `line`/`type`; Golemio resolves both at build time.
 */
export interface AppStopConnection {
    trip_id: string;
    vehicle_id?: string;
    route_id?: string;
    line?: string;
    type?: AppRouteType;
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
    /** The feed's stop id where it reports no stop sequence (Brno), for a detail to place the vehicle on its trip. */
    last_stop_id?: string;
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
    /** The platform a departure leaves from when `stopId` is the station the client asked for. */
    platformStopId?: string;
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
     * The affected lines, unresolved: the route id the GTFS-RT feed gives (numeric for KORDIS, the
     * routes.json key for PID), or the line name for RSS exclusions, which carry no id. The frontend
     * resolves names, types and colours from its own routes.json join.
     */
    lines?: string[];
    cause?: string;
    causeDetail?: { cs?: string; en?: string };
    effect?: string;
    /** Where the disruption is, when its source places it (KORDIS diversions). */
    location?: { lat: number; lon: number };
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

/** `/api/cities`: every city's shared facts. */
export interface AppCitiesResponse {
    cities: CityFacts[];
}
