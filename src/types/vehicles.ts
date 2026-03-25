export interface VehicleDescriptor {
    operator?: string;
    vehicle_type?: string;
    is_wheelchair_accessible?: boolean | null;
    is_air_conditioned?: boolean | null;
    has_usb_chargers?: boolean | null;
    vehicle_registration_number?: string | number;
}

export interface BaseVehicleProperties {
    vehicle_id: string | null;
    gtfs_trip_id: string;
    route_short_name?: string;
    route_type?: string | number;
    trip_headsign?: string;
    bearing: number | null | undefined;
    delay: number;
    state_position?: string;
    next_stop_name?: string;
    run_number?: number | string;
    last_stop_sequence?: number | null;
    origin_timestamp?: string;
    vehicle_descriptor?: VehicleDescriptor;
}

export interface VehicleProperties extends BaseVehicleProperties {
    state_position: string; // Required in map features
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
            };
        }>;
    };
    shapes?: number[][];
    is_static_fallback?: boolean;
}
