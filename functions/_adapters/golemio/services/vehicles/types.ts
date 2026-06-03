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
    properties: {
        shape_dist_traveled: number;
    };
}

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
