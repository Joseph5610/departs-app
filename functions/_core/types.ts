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
}

export interface AppStopProperties {
    stop_id: string;
    stop_name: string;
    platform_code?: string | null;
    location_type: number | string;
    parent_station: string | null;
    zone_id: string | null;
    is_centroid?: boolean;
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
        type: string | number;
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
    route_type: string | number;
    trip_headsign: string;
    bearing: number | null;
    delay: number;
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
    delay: number;
    line: string;
    type: string;
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
    line_metadata?: Array<{ name: string; route_color: string; type: string }>;
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
}

export interface AppCitiesResponse {
    cities: AppCity[];
}
