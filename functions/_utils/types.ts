export interface Env {
    GOLEMIO_API_KEY: string;
}

// --- Golemio API Types ---

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
        has_usb_chargers?: boolean;
        usb_chargers?: boolean;
        operator?: string;
        vehicle_registration_number?: number;
        run_number?: number | string;
        service_number?: number | string;
        last_stop_sequence?: number;
        origin_timestamp?: string;
        vehicle_descriptor?: {
            is_wheelchair_accessible?: boolean;
            is_air_conditioned?: boolean;
            has_usb_chargers?: boolean;
            vehicle_registration_number?: string | number;
            operator?: string;
        };
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
            next_stop_name?: string;
            vehicle_descriptor?: {
                is_wheelchair_accessible?: boolean;
                is_air_conditioned?: boolean;
                has_usb_chargers?: boolean;
                vehicle_registration_number?: string | number;
                operator?: string;
            };
            operator?: string;
            origin_timestamp?: string;
        };
        last_position?: {
            run_number?: number | string;
            bearing?: number;
            delay?: number | { actual?: number };
            state_position?: string;
            next_stop?: { id?: string; name?: string };
            vehicle_descriptor?: {
                is_wheelchair_accessible?: boolean;
                is_air_conditioned?: boolean;
                has_usb_chargers?: boolean;
                vehicle_registration_number?: string | number;
                operator?: string;
            };
            vehicle_registration_number?: number | string;
            operator?: string;
            last_stop?: { sequence?: number };
            last_stop_sequence?: number;
            origin_timestamp?: string;
            timestamp?: string;
        };
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

export interface AppRSSItem {
    type: 'incident' | 'exclusion';
    title: string;
    link: string;
    displayDate?: string; // Pre-formatted string for UI
    guid?: string;
    priority?: string;
    lines?: string[];
    isActive?: boolean;
    isFuture?: boolean;
}

export interface AppRSSResponse {
    alerts: AppRSSItem[];
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
}

export interface AppVehicleProperties {
    vehicle_id: string;
    gtfs_trip_id?: string;
    trip_id?: string;
    route_short_name?: string;
    gtfs_route_short_name?: string;
    route_type?: string;
    trip_headsign?: string;
    gtfs_trip_headsign?: string;
    bearing?: number;
    delay: number;
    state_position?: string;
    next_stop_name?: string;
    is_wheelchair_accessible?: boolean;
    is_air_conditioned?: boolean;
    vehicle_registration_number?: number;
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
