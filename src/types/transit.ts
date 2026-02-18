/**
 * Common transit-related types and interfaces for the Departs.app project.
 */

/**
 * Vehicle Properties coming from the API (normalized).
 */
export interface VehicleProperties {
    vehicle_id: string;
    route_type: string | number;
    gtfs_route_short_name: string;
    gtfs_route_type?: string | number;
    gtfs_trip_id: string;
    gtfs_trip_headsign?: string;
    route_short_name?: string;
    trip_headsign?: string;
    bearing: number | null | undefined;
    delay: number;
    state_position: string;
    last_stop_name?: string;
    next_stop_name?: string;
    last_updated?: string;
    origin_timestamp?: string;
    is_air_conditioned?: boolean;
    is_wheelchair_accessible?: boolean;
    has_usb_chargers?: boolean;
    vehicle_registration_number?: string;
    operator?: string;
    run_number?: number | string;
}

/**
 * GeoJSON Feature for a vehicle position.
 */
export interface VehicleFeature {
    type: "Feature";
    geometry: {
        type: "Point";
        coordinates: [number, number]; // [lon, lat]
    };
    properties: VehicleProperties;
}

/**
 * Collection of vehicles in GeoJSON format.
 */
export interface VehicleCollection {
    type: "FeatureCollection";
    features: VehicleFeature[];
}

/**
 * GeoJSON Feature for a transit stop.
 */
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
        metro_a?: number;
        metro_b?: number;
        metro_c?: number;
        variant_seed?: number;
    };
}

/**
 * Collection of stops in GeoJSON format.
 */
export interface StopCollection {
    type: "FeatureCollection";
    features: StopFeature[];
}

/**
 * Individual departure entry for a stop.
 */
export interface Departure {
    timestamp: string;
    scheduled: string;
    delay: number;
    line: string;
    type: string | number;
    directionId: string;
    headsign: string;
    isCanceled: boolean;
    tripId?: string;
    vehicleId?: string;
}

/**
 * Alert structure for service incidents and exclusions.
 */
export interface Alert {
    id: string;
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    isPlanned: boolean;
    isActive: boolean;
    url?: string;
    type: 'incident' | 'exclusion' | 'incidents' | 'exclusions';
}

/**
 * RSS item from the alerts feed.
 */
export interface RSSItem {
    title: string;
    link: string;
    pubDate: string;
    content: string;
    contentSnippet: string;
    guid: string;
    isoDate: string;
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    priority?: string;
    lines?: string[];
    type?: 'incidents' | 'exclusions';
    isActive?: boolean;
    isFuture?: boolean;
}

/**
 * Detailed information for a specific vehicle (includes stop times and shapes).
 */
export interface VehicleDetail {
    gtfs_trip_id: string;
    route_short_name: string;
    trip_headsign: string;
    delay: number;
    state_position: string;
    last_stop_sequence?: number;
    origin_timestamp?: string;
    run_number?: number | string;
    vehicle_id?: string;
    geometry?: {
        type: "Point";
        coordinates: [number, number];
    };
    vehicle_descriptor?: {
        operator?: string;
        vehicle_type?: string;
        is_wheelchair_accessible?: boolean;
        is_air_conditioned?: boolean;
        has_usb_chargers?: boolean;
        vehicle_registration_number?: string;
    };
    stop_times?: {
        features: Array<{
            properties: {
                stop_name: string;
                stop_sequence: number;
                arrival_time: string;
                realtime_arrival_time?: string;
                departure_time?: string;
                realtime_departure_time?: string;
            };
        }>;
    };
    shapes?: number[][];
}

/**
 * Simplified structure for a vehicle being actively tracked on the map.
 * Merges properties from list view and details view.
 */
export interface TrackedVehicle extends Partial<VehicleProperties> {
    vehicle_id: string;
    _geometry: [number, number];
    // Sync compatibility with older data/logic
    trip_id?: string;
    id?: string;
    // Explicitly copied properties for UI convenience
    usb_chargers?: boolean;
}
