
export type RouteType = 'tram' | 'metro' | 'train' | 'bus' | 'ferry' | 'funicular' | 'trolleybus' | 'unknown';

/** One route's display branding, as published in `<city>/routes.json` (see `useRouteMetadata`). */
export interface RouteInfo {
    name: string;
    type: string;
    route_color: string;
}

interface VehicleDescriptor {
    operator?: string;
    vehicle_type?: string;
    is_wheelchair_accessible?: boolean | null;
    is_air_conditioned?: boolean | null;
    has_usb_chargers?: boolean | null;
    vehicle_registration_number?: string | number;
}

type VehicleState =
    | 'at_stop' 
    | 'before_track' 
    | 'before_track_delayed' 
    | 'canceled' 
    | 'off_track' 
    | 'on_track'
    | 'unknown';

interface BaseVehicleProperties {
    vehicle_id: string | null;
    gtfs_trip_id: string;
    route_short_name: string;
    route_type: RouteType;
    trip_headsign?: string;
    bearing: number | null | undefined;
    delay: number | null;
    state_position?: VehicleState;
    run_number?: number | string;
    last_stop_sequence?: number | null;
    origin_timestamp?: string;
    vehicle_descriptor?: VehicleDescriptor;
    route_color: string;
    is_enriched?: boolean;
    shape_dist_traveled?: number;
}

export interface VehicleProperties extends BaseVehicleProperties {
    state_position: VehicleState; // Required in map features
    last_updated?: string;
}

export interface VehicleFeature {
    type: "Feature";
    geometry: {
        type: "Point";
        coordinates: [number, number]; // [lon, lat]
    };
    properties: VehicleProperties;
}

export interface VehicleCollection {
    type: "FeatureCollection";
    features: VehicleFeature[];
    status?: 'ok' | 'stale' | 'upstream_offline';
    last_updated?: string;
}

export interface VehicleDetail extends BaseVehicleProperties {
    geometry?: {
        type: "Point";
        coordinates: [number, number];
    };
    stop_times?: {
        type: "FeatureCollection";
        features: Array<{
            type: "Feature";
            geometry: {
                type: "Point";
                coordinates: [number, number];
            };
            properties: {
                stop_name: string;
                stop_sequence: number;
                zone_id?: string;
                is_wheelchair_accessible?: boolean | null;
                shape_dist_traveled?: number;
                arrival_time: string;
                departure_time: string;
                realtime_arrival_time?: string;
                realtime_departure_time?: string;
                stop_id: string;
                is_request_stop?: boolean;
                connections?: StopConnection[];
                continues_as?: Continuation;
            };
        }>;
    };
    is_static_fallback?: boolean;
}

/** An onward trip scheduled to wait at a stop for the trip being viewed. */
export interface StopConnection {
    trip_id: string;
    vehicle_id?: string;
    line: string;
    route_color?: string;
    type: RouteType;
    headsign: string;
    departure_time: string;
    delay: number | null;
    max_wait_s: number;
    at_risk: boolean;
}

/** The trip the same vehicle continues as; ids are absent when only the line is known. */
export interface Continuation {
    trip_id?: string;
    vehicle_id?: string;
    line: string;
    route_color?: string;
    type: RouteType;
    headsign: string;
    departure_time?: string;
}
