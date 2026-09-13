import type { RouteType } from './vehicles';

export interface CityStats {
    total_vehicles: number;
    total_lines: number;
    average_delay: number | null;
    low_floor_count: number;
    air_conditioned_count: number;
    delayed_over_5_min_count: number;
    delay_distribution: {
        on_time: number;
        delayed_1_to_5: number;
        delayed_5_plus: number;
    };
    state_distribution: {
        in_transit: number;
        at_stop: number;
        off_track: number;
        other: number;
    };
    vehicle_types: Record<string, number>;
    total_delay_seconds: number;
    busiest_lines: Array<{
        line: string;
        count: number;
        route_color: string;
    }>;
    most_delayed: Array<{
        vehicle_id: string;
        gtfs_trip_id: string;
        line: string;
        delay: number;
        route_type: RouteType;
        route_color: string;
    }>;
    timestamp: string;
}
