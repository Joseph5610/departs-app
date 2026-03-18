export interface VehicleProperties {
    vehicle_id: string;
    route_type: string;
    gtfs_trip_id: string;
    route_short_name?: string;
    trip_headsign?: string;
    bearing: number | null | undefined;
    delay: number;
    state_position: string;
    next_stop_name?: string;
    last_updated?: string;
    vehicle_descriptor?: {
        operator?: string;
        vehicle_type?: string;
        is_wheelchair_accessible?: boolean;
        is_air_conditioned?: boolean;
        has_usb_chargers?: boolean;
        vehicle_registration_number?: string;
    };
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
}

export interface StopFeature {
    type: "Feature";
    geometry: {
        type: "Point";
        coordinates: [number, number];
    };
    properties: {
        stop_id: string;
        stop_name: string;
        platform_code?: string;
        location_type: number;
        parent_station?: string;
        zone_id?: string;
        is_centroid?: boolean;
        is_train?: number;
        metro_a?: number;
        metro_b?: number;
        metro_c?: number;
        metro_lines?: string[];
        variant_seed?: number;
        all_ids?: string[];
    };
}

export interface StopCollection {
    type: "FeatureCollection";
    features: StopFeature[];
}

export interface SelectedStop {
    id: string;
    name: string;
    platformCode?: string;
    coordinates?: [number, number];
    isTrain?: boolean;
    all_ids?: string[];
}

export interface Departure {
    timestamp: string;
    scheduled: string;
    delay: number;
    delayDelta?: number;
    lastDelayUpdate?: number;
    line: string;
    type: string;
    directionId: string;
    headsign: string;
    isCanceled: boolean;
    tripId?: string;
    vehicleId?: string;
    platform?: string;
}

export interface RSSItem {
    type: 'incident' | 'exclusion';
    title: string;
    description: string | null;
    valid_from: string | null;
    valid_to: string | null;
    link: string;
    guid?: string;
    priority?: string;
    lines?: string[];
    isActive?: boolean;
    isFuture?: boolean;
}

export interface RSSResponse {
    alerts: RSSItem[];
}

export interface Infotext {
    id: string;
    text: string;
    textEn: string | null;
    priority: 'low' | 'normal' | 'high';
    displayType: 'inline' | 'general';
    relatedStopIds: string[];
    valid_from: string;
    valid_to: string | null;
}

export interface VehicleDetail {
    vehicle_id: string;
    gtfs_trip_id: string;
    route_short_name?: string;
    route_type?: string | number;
    trip_headsign?: string;
    bearing: number | null;
    delay: number;
    state_position?: string;
    last_stop_sequence?: number | null;
    origin_timestamp?: string;
    run_number?: number | string;
    vehicle_descriptor?: {
        operator?: string;
        vehicle_type?: string;
        vehicle_registration_number?: string;
        is_wheelchair_accessible?: boolean;
        is_air_conditioned?: boolean;
        has_usb_chargers?: boolean;
    };
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
            };
        }>;
    };
    shapes?: number[][];
    is_static_fallback?: boolean;
    next_stop_name?: string;
}

export type SearchHistoryBase =
    | { type: 'stop'; id: string; name: string; platformCode?: string; coordinates: [number, number]; isTrain?: boolean }
    | { type: 'line'; lines: string[] };

export type SearchHistoryItem = SearchHistoryBase & { timestamp: number };
