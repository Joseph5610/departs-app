export interface Env {
    GOLEMIO_API_KEY: string;
}

// --- Golemio API Types ---

export interface GolemioVehicleDescriptor {
    operator?: string;
    vehicle_type?: string;
    is_wheelchair_accessible?: boolean | null;
    is_air_conditioned?: boolean | null;
    has_usb_chargers?: boolean | null;
    vehicle_registration_number?: string | number;
}

export interface GolemioVehicleFeature {
    type: 'Feature';
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
    properties: {
        vehicle_id?: string | number;
        id?: string | number;
        gtfs_trip_id?: string;
        gtfs_route_short_name?: string;
        gtfs_route_type?: string;
        gtfs_trip_headsign?: string;
        route_short_name?: string;
        route_type?: string;
        trip_headsign?: string;
        bearing?: number;
        delay?: number;
        state_position?: string;
        next_stop_name?: string;
        is_wheelchair_accessible?: boolean;
        is_air_conditioned?: boolean;
        vehicle_registration_number?: number;
        run_number?: number | string;
        service_number?: number | string;
        trip?: {
            gtfs?: {
                trip_id?: string;
                route_short_name?: string;
                route_type?: string;
                trip_headsign?: string;
                run_number?: number | string;
            };
            run_number?: number | string;
            service_number?: number | string;
            wheelchair_accessible?: boolean;
            air_conditioned?: boolean;
            vehicle_registration_number?: number;
            operator?: string;
            vehicle_type?: string;
            next_stop_name?: string;
            origin_timestamp?: string;
            vehicle_descriptor?: GolemioVehicleDescriptor;
        };
        last_position?: {
            run_number?: number | string;
            bearing?: number;
            delay?: { actual?: number } | number;
            state_position?: string;
            next_stop?: { id?: string; name?: string };
            vehicle_registration_number?: number;
            operator?: string;
            vehicle_type?: string;
            origin_timestamp?: string;
            timestamp?: string;
            last_stop?: { sequence?: number };
            last_stop_sequence?: number;
            vehicle_descriptor?: GolemioVehicleDescriptor;
        };
        vehicle_descriptor?: GolemioVehicleDescriptor;
        [key: string]: unknown;
    };
}

export interface GolemioDepartureItem {
    departure: {
        timestamp_predicted: string | null;
        timestamp_scheduled: string;
        delay_seconds: number | null;
    };
    route: {
        short_name: string;
        type: string | number;
    };
    trip: {
        id: string;
        direction_id: string | number;
        headsign: string;
        is_canceled: boolean;
    };
    stop: {
        id: string;
        platform_code: string | null;
    };
    vehicle?: {
        id: string;
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

export interface GolemioStopFeature {
    type: 'Feature';
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
    properties: {
        stop_id: string;
        stop_name: string;
        platform_code: string | null;
        location_type: number | string;
        parent_station: string | null;
        zone_id: string | null;
        all_ids?: string[];
        metro_lines?: string[];
        is_centroid?: boolean;
        [key: string]: unknown;
    };
}

// --- Application Internal Types (Response Structures) ---

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
    color?: string;
}

export interface AppVehicleProperties {
    vehicle_id?: string;
    gtfs_trip_id?: string;
    route_short_name?: string;
    route_type?: string;
    trip_headsign?: string;
    bearing?: number;
    delay: number;
    state_position?: string;
    next_stop_name?: string;
    last_stop_sequence?: number;
    origin_timestamp?: string;
    run_number?: number | string;
    vehicle_descriptor?: GolemioVehicleDescriptor;
}

export interface AppStopProperties {
    stop_id: string;
    stop_name: string;
    platform_code?: string;
    location_type: number;
    parent_station?: string;
    zone_id?: string;
    is_centroid?: boolean;
    is_train?: number;
    metro_lines?: string[];
    all_ids?: string[];
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
