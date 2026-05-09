export interface Env {
    GOLEMIO_API_KEY: string;
}

// --- Golemio RAW Types ---
export interface GolemioVehicleDescriptor {
    operator?: string;
    vehicle_type?: string;
    is_wheelchair_accessible?: boolean | null;
    is_air_conditioned?: boolean | null;
    has_usb_chargers?: boolean | null;
    vehicle_registration_number?: string | number;
}

export interface GolemioVehicleProperties {
    vehicle_id?: string | number;
    id?: string | number;
    gtfs_trip_id?: string;
    route_short_name?: string;
    gtfs_route_short_name?: string;
    route_type?: string | number;
    trip_headsign?: string;
    gtfs_trip_headsign?: string;
    bearing?: number | string;
    delay?: number | string;
    state_position?: string;
    next_stop_name?: string;
    last_stop_sequence?: number | string;
    origin_timestamp?: string;
    run_number?: number | string;
    vehicle_descriptor?: GolemioVehicleDescriptor;
}

export interface GolemioVehicleFeature {
    type: 'Feature';
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    } | null;
    properties: GolemioVehicleProperties;
}

/**
 * Golemio vehicle response — can be either:
 *   - A FeatureCollection with `features[]`
 *   - A bare Feature with properties at the top level
 * We model both shapes here to avoid `as unknown` casts.
 */
export interface GolemioVehiclePayload extends Partial<GolemioVehicleProperties> {
    type?: string;
    features?: GolemioVehicleFeature[];
    geometry?: { type: 'Point'; coordinates: [number, number] } | null;
    stop_times?: { features: GolemioStopTimeFeature[] };
    shapes?: GolemioShapeFeature[] | { features: GolemioShapeFeature[] };
    vehicle_descriptor?: GolemioVehicleDescriptor;
    last_stop_sequence?: number;
    origin_timestamp?: string;
    next_stop_name?: string;
}

export interface GolemioStopProperties {
    stop_id: string;
    stop_name: string;
    location_type: number;
    parent_station?: string | null;
    platform_code?: string | null;
    zone_id?: string | null;
    wheelchair_boarding?: number;
    level_id?: string | null;
}

export interface GolemioStopFeature {
    type: 'Feature';
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
    properties: GolemioStopProperties;
}

export interface GolemioStopPayload {
    type: 'FeatureCollection';
    features: GolemioStopFeature[];
}

export interface GolemioStopTimeProperties {
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
}

export interface GolemioStopTimeFeature {
    type: 'Feature';
    geometry?: {
        type: string;
        coordinates: number[] | number[][];
    };
    properties: GolemioStopTimeProperties;
}

export interface GolemioShapeFeature {
    type: 'Feature';
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
    properties?: Record<string, unknown>;
}

export interface GolemioDepartureItem {
    departure: {
        timestamp_predicted: string | null;
        timestamp_scheduled: string;
        delay_seconds: number | null;
        minutes?: number;
    };
    route: {
        short_name: string;
        type: string | number;
    };
    trip: {
        id: string;
        direction_id?: string | number;
        headsign: string;
        is_canceled: boolean;
    };
    stop: {
        id: string;
        platform_code: string | null;
        sequence?: number;
    };
    vehicle?: {
        id: string;
        is_wheelchair_accessible?: boolean | null;
        is_air_conditioned?: boolean | null;
        has_charger?: boolean | null;
    };
}

export interface GolemioInfotext {
    id: string;
    priority: 'low' | 'normal' | 'high';
    display_type: 'inline' | 'general';
    text: string;
    text_en: string | null;
    related_stops: Array<{
        id: string;
        name: string;
        platform_code: string | null;
    }>;
    valid_from: string;
    valid_to: string | null;
}

// --- Application Internal Types (Response Structures) ---
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

export interface AppVehicleProperties {
    vehicle_id: string;
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
    vehicle_descriptor?: GolemioVehicleDescriptor;
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
            properties: GolemioStopTimeProperties & { metro_lines: Array<{ name: string; route_color: string }> };
            geometry?: {
                type: string;
                coordinates: number[] | number[][];
            };
        }>;
    };
    route_geojson?: {
        type: 'FeatureCollection';
        features: Array<{
            type: 'Feature';
            geometry: {
                type: 'LineString';
                coordinates: [number, number][];
            };
            properties: {
                route_color: string;
            };
        }>;
    };
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
    headsign_metro_lines?: Array<{ name: string; route_color: string }>;
}

export interface AppRSSItem {
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
}

export interface AppRSSResponse {
    alerts: AppRSSItem[];
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
