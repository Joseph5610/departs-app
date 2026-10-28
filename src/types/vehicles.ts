import type { AppContinuation, AppRouteType, AppStopConnection, AppStopTimeProperties, AppVehicleCollection, AppVehicleFeature, AppVehicleProperties } from '@shared/api';

export type RouteType = AppRouteType;

/** One route's display branding, as published in `<city>/routes.json` (see `useRouteMetadata`). */
export interface RouteInfo {
    name: string;
    /** departs-data publishes the app's vehicle type, never a GTFS `route_type` code. */
    type: RouteType;
    route_color: string;
    /** A night line: listed after the day lines and left off stop badges outside the city's night hours. */
    night?: true;
}

/** A vehicle as the API sends it, plus the branding and estimates the app adds. */
interface BaseVehicleProperties extends AppVehicleProperties {
    /** From routes.json; absent until it has loaded or for a line it does not list. */
    route_color?: string;
    is_enriched?: boolean;
    /** `delay` is the app's own estimate from the timetable and position (see `estimateDelay`). */
    is_delay_estimated?: boolean;
    /** Set on a vehicle of a neighbouring network shown beside the selected city's. */
    city_slug?: string;
}

export interface VehicleProperties extends BaseVehicleProperties {
    last_updated?: string;
}

/** A fleet vehicle with a position: the app drops the ones the feed sends without (`withPositions`). */
export interface VehicleFeature extends AppVehicleFeature {
    geometry: NonNullable<AppVehicleFeature['geometry']>;
    properties: VehicleProperties;
}

export interface VehicleCollection extends AppVehicleCollection {
    features: VehicleFeature[];
}

export interface VehicleDetail extends BaseVehicleProperties {
    geometry?: {
        type: "Point";
        coordinates: [number, number];
    };
    stop_times?: {
        features: Array<{
            type: "Feature";
            /** Absent for a stop the network has no position for. */
            geometry?: {
                type: "Point";
                coordinates: [number, number];
            };
            properties: StopTimeProperties;
        }>;
    };
}

/** A stop of a trip as the API sends it, with the onward trips the app has resolved. */
export interface StopTimeProperties extends AppStopTimeProperties {
    connections?: StopConnection[];
    continues_as?: Continuation;
}

/** One stop of a trip's `stop_times`. */
export type StopTimeFeature = NonNullable<VehicleDetail['stop_times']>['features'][number];

/** An onward trip scheduled to wait at a stop for the trip being viewed. */
export interface StopConnection extends AppStopConnection {
    route_color?: string;
}

/** The trip the same vehicle continues as; ids are absent when only the line is known. */
export interface Continuation extends AppContinuation {
    route_color?: string;
}

/** A vehicle's entry in its city's fleet register (the static data CDN's `vehicleMetadata` file). */
export interface VehicleMetadata {
    operator: string;
    vehicle_type?: string;
    is_air_conditioned?: boolean;
    is_wheelchair_accessible?: boolean;
}

/** A vehicle's register entry by its id; undefined for a vehicle the register does not list. */
export type FleetLookup = (vehicleId: string | null | undefined) => VehicleMetadata | undefined;

/**
 * One hour of a city's timetable (`stop_times/<HH>.json` on the static data CDN, departs-data
 * `StopTimeSliceFile`): every trip a vehicle may be running in that hour. A trip row repeats `[stopIndex, arrMin, dwellMin]`; `arrMin` is service-day minutes for the
 * first stop and minutes since the previous stop's departure after it.
 */
export interface StopTimeSlice {
    stops: string[];
    coords: [number, number][];
    trips: Record<string, number[]>;
}
