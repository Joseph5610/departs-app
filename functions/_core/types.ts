import type { Fetcher } from "@cloudflare/workers-types";

export interface Env {
    ASSETS: Fetcher;
    [key: string]: unknown;
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
    metro_lines: Array<{ name: string; route_color: string }>;
    is_request_stop?: boolean;
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
    trip_headsign: string;
    bearing: number | null;
    delay: number | null;
    state_position?: string;
    next_stop_name?: string;
    last_stop_sequence?: number | null;
    origin_timestamp?: string;
    run_number?: string;
    vehicle_descriptor?: AppVehicleDescriptor;
    is_static_fallback?: boolean;
    route_color: string;
    is_night: boolean;
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
        is_start?: boolean;
        is_end?: boolean;
        is_regular?: boolean;
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
    headsign_metro_lines?: Array<{ name: string; route_color: string }>;
    stopId?: string;
    is_request_stop?: boolean;
}

export interface AppDepartureResponse {
    departures: AppDeparture[];
}

export interface AppAlert {
    type: 'incident' | 'exclusion';
    title: string;
    description: string | null;
    link: string;
    valid_from: string | null;
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
    valid_from: string;
    valid_to: string | null;
}

export interface AppAlertsResponse {
    alerts: AppAlert[];
}

export interface AppCity {
    slug: string;
    name: string;
    center: [number, number];
    bounds: [number, number, number, number];
    isBeta?: boolean;
    virtualTableUrl?: string;
    filters?: {
        vehicles: string[];
        stops: string[];
    };
}

export interface AppCitiesResponse {
    cities: AppCity[];
}

export interface AppCityStats {
    total_vehicles: number;
    total_lines: number;
    average_delay: number | null;
    low_floor_count: number;
    air_conditioned_count: number;
    delayed_over_5_min_count: number;
    
    // Distributions
    delay_distribution: {
        on_time: number; // <= 1 min
        delayed_1_to_5: number;
        delayed_5_plus: number;
    };
    state_distribution: {
        in_transit: number;
        at_stop: number;
        off_track: number;
        other: number;
    };
    vehicle_types: Record<string, number>;
    
    // Total sum
    total_delay_seconds: number;
    
    // Top lists
    busiest_lines: Array<{
        line: string;
        count: number;
        route_color: string;
    }>;
    
    // Top 5 delayed
    most_delayed: Array<{
        vehicle_id: string;
        gtfs_trip_id: string;
        line: string;
        delay: number;
        route_type: AppRouteType;
        route_color: string;
    }>;
    
    timestamp: string;
}
