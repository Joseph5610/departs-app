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
        vehicle_id?: string;
        id?: string;
        trip?: {
            gtfs?: {
                trip_id?: string;
                route_short_name?: string;
                route_type?: string;
                trip_headsign?: string;
            };
            wheelchair_accessible?: boolean;
            air_conditioned?: boolean;
            vehicle_registration_number?: number;
        };
        last_position?: {
            bearing?: number;
            delay?: { actual?: number };
            state_position?: string;
            next_stop?: { id?: string };
        };
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
    metro_lines?: string[];
}
