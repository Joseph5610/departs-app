import type { CityStats, RouteType, VehicleFeature } from '../types/transit';
import { STATS_AGGREGATION } from '../config/transit';

const AT_STOP_STATES = new Set(['at_stop', 'before_track', 'before_track_delayed']);

/**
 * Aggregates delay, movement, fleet and line statistics from a collection of vehicle features.
 */
export function aggregateCityStats(features: VehicleFeature[]): CityStats {
    let delaySum = 0;
    let delayCount = 0;
    let lowFloorCount = 0;
    let airConditionedCount = 0;
    let delayedOver5MinCount = 0;

    const delayDistribution = { on_time: 0, delayed_1_to_5: 0, delayed_5_plus: 0 };
    const stateDistribution = { in_transit: 0, at_stop: 0, off_track: 0, other: 0 };
    const vehicleTypes: Record<string, number> = {};
    const lineCounts: Record<string, { count: number; route_color: string }> = {};
    const delayedVehicles: CityStats['most_delayed'] = [];

    for (const feature of features) {
        if (!feature) continue;

        const p = feature.properties;
        if (p.route_short_name) {
            const lineStr = p.route_short_name.toString();
            if (!lineCounts[lineStr]) {
                lineCounts[lineStr] = { count: 0, route_color: p.route_color || '' };
            }
            lineCounts[lineStr].count++;
        }

        const delay = typeof p.delay === 'number' ? p.delay : null;

        if (p.vehicle_descriptor?.is_wheelchair_accessible) lowFloorCount++;
        if (p.vehicle_descriptor?.is_air_conditioned) airConditionedCount++;

        const rType = String(p.route_type || 'unknown').toLowerCase() as RouteType;
        vehicleTypes[rType] = (vehicleTypes[rType] || 0) + 1;

        const state = String(p.state_position || 'unknown').toLowerCase();
        if (AT_STOP_STATES.has(state)) {
            stateDistribution.at_stop++;
        } else if (state === 'off_track') {
            stateDistribution.off_track++;
        } else if (state === 'on_track') {
            stateDistribution.in_transit++;
        } else {
            stateDistribution.other++;
        }

        if (delay !== null && Math.abs(delay) < STATS_AGGREGATION.MAX_PLAUSIBLE_DELAY_S) {
            delaySum += delay;
            delayCount++;
            if (delay > STATS_AGGREGATION.DELAYED_THRESHOLD_S) {
                delayedOver5MinCount++;
            }

            if (delay <= STATS_AGGREGATION.ON_TIME_MAX_DELAY_S) delayDistribution.on_time++;
            else if (delay <= STATS_AGGREGATION.DELAYED_THRESHOLD_S) delayDistribution.delayed_1_to_5++;
            else delayDistribution.delayed_5_plus++;

            if (delay > STATS_AGGREGATION.DELAYED_THRESHOLD_S && p.route_short_name) {
                delayedVehicles.push({
                    vehicle_id: p.vehicle_id || p.vehicle_descriptor?.vehicle_registration_number?.toString() || STATS_AGGREGATION.MISSING_ID,
                    gtfs_trip_id: p.gtfs_trip_id || STATS_AGGREGATION.MISSING_ID,
                    line: p.route_short_name.toString(),
                    delay,
                    route_type: rType,
                    route_color: p.route_color || ''
                });
            }
        }
    }

    delayedVehicles.sort((a, b) => b.delay - a.delay);

    const busiest_lines = Object.entries(lineCounts)
        .map(([line, data]) => ({ line, count: data.count, route_color: data.route_color }))
        .sort((a, b) => b.count - a.count)
        .slice(0, STATS_AGGREGATION.BUSIEST_LINES_LIMIT);

    return {
        total_vehicles: features.length,
        total_lines: Object.keys(lineCounts).length,
        average_delay: delayCount > 0 ? delaySum / delayCount : null,
        total_delay_seconds: delaySum,
        low_floor_count: lowFloorCount,
        air_conditioned_count: airConditionedCount,
        delayed_over_5_min_count: delayedOver5MinCount,
        delay_distribution: delayDistribution,
        state_distribution: stateDistribution,
        vehicle_types: vehicleTypes,
        busiest_lines,
        most_delayed: delayedVehicles.slice(0, STATS_AGGREGATION.MOST_DELAYED_LIMIT),
        timestamp: new Date().toISOString()
    };
}
