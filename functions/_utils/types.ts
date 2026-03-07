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
        };
        last_position?: {
            run_number?: number | string;
            bearing?: number;
            delay?: { actual?: number };
            state_position?: string;
            next_stop?: { id?: string };
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

export interface GolemioParkingFeature {
    type: 'Feature';
    geometry: {
        type: 'Point' | 'Polygon' | 'MultiPolygon';
        coordinates: any;
    };
    properties: {
        id: string;
        name: string | null;
        parking_policy: string | null;
        parking_type: string | null;
        last_updated_at: string;
        has_occupancy_info: boolean;
        capacity: number | null;
        [key: string]: any;
    };
}

export interface GolemioParkingOccupancy {
    parking_id: string;
    free_spot_number: number | null;
    occupied_spot_number: number | null;
    total_spot_number: number | null;
    last_updated: string;
}

export interface GolemioAirQualityFeature {
    type: 'Feature';
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
    properties: {
        id: string;
        name: string;
        measurement: {
            AQ_hourly_index: number;
            components: Array<{
                type: string;
                averaged_time: { value: number };
            }>;
        };
        updated_at: string;
    };
}

export interface GolemioSharedCarFeature {
    type: 'Feature';
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
    properties: {
        id: string;
        name: string;
        company: { name: string };
        updated_at: string;
    };
}

export interface GolemioBicycleCounterFeature {
    type: 'Feature';
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
    properties: {
        id: string;
        name: string;
        updated_at: string;
    };
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
