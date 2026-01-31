export interface VehicleProperties {
    vehicle_id: string;
    route_type: string;
    gtfs_route_short_name: string;
    gtfs_route_type?: string;
    gtfs_trip_id: string;
    gtfs_trip_headsign?: string;
    route_short_name?: string;
    trip_headsign?: string;
    bearing: number | null;
    delay: number | null;
    state_position: string;
    last_stop_name?: string;
    next_stop_name?: string;
    last_updated?: string;
}

export interface LiteVehicleProperties {
    id: string;       // vehicle_id
    tId?: string;     // gtfs_trip_id
    n?: string;       // route_short_name (Number)
    t?: string;       // route_type (Type)
    b?: number;       // bearing
    d?: number;       // delay
}

export interface VehicleFeature {
    type: "Feature";
    geometry: {
        type: "Point";
        coordinates: [number, number]; // [lon, lat]
    };
    properties: VehicleProperties | LiteVehicleProperties;
}

export interface VehicleCollection {
    type: "FeatureCollection";
    features: VehicleFeature[];
}
