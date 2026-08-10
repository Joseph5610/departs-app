import type { AppVehicleFeature, AppCityStats, AppRouteType } from '../types';

/**
 * Aggregates network-wide statistics from a collection of active vehicle features.
 * Computes delay averages, distributions, vehicle types, fleet capabilities (AC/Wheelchair),
 * and identifies the most delayed vehicles and busiest lines.
 *
 * @param features - Array of normalized AppVehicleFeature objects representing active vehicles.
 * @returns An AppCityStats object containing the aggregated statistical metrics.
 */
export function aggregateCityStats(features: AppVehicleFeature[]): AppCityStats {
    let delaySum = 0;
    let delayCount = 0;
    let lowFloorCount = 0;
    let airConditionedCount = 0;
    let delayedOver5MinCount = 0;
    
    const delayDistribution = { on_time: 0, delayed_1_to_5: 0, delayed_5_plus: 0 };
    const stateDistribution = { in_transit: 0, at_stop: 0, off_track: 0, other: 0 };
    const vehicleTypes: Record<string, number> = {};
    const lineCounts: Record<string, { count: number; route_color: string }> = {};
    const delayedVehicles: Array<{
        vehicle_id: string;
        gtfs_trip_id: string;
        line: string;
        delay: number;
        route_type: AppRouteType;
        route_color: string;
    }> = [];

    const lines = new Set<string>();

    for (const feature of features) {
        if (!feature) continue;
        
        const p = feature.properties;
        if (p.route_short_name) {
            const lineStr = p.route_short_name.toString();
            lines.add(lineStr);
            
            if (!lineCounts[lineStr]) {
                lineCounts[lineStr] = { count: 0, route_color: p.route_color || '' };
            }
            lineCounts[lineStr].count++;
        }

        const delay = typeof p.delay === 'number' ? p.delay : null;

        if (p.vehicle_descriptor?.is_wheelchair_accessible) lowFloorCount++;
        if (p.vehicle_descriptor?.is_air_conditioned) airConditionedCount++;
        
        // Distributions
        const rType = String(p.route_type || 'unknown').toLowerCase() as AppRouteType;
        vehicleTypes[rType] = (vehicleTypes[rType] || 0) + 1;
        
        const state = String(p.state_position || 'unknown').toLowerCase();
        if (['at_stop', 'before_track', 'before_track_delayed'].includes(state)) {
            stateDistribution.at_stop++;
        } else if (state === 'off_track') {
            stateDistribution.off_track++;
        } else if (state === 'on_track') {
            stateDistribution.in_transit++;
        } else {
            stateDistribution.other++;
        }
        
        // Filter delays > 120 mins as ghost vehicles
        if (delay !== null && delay < 7200) {
            delaySum += delay;
            delayCount++;
            if (delay > 300) {
                delayedOver5MinCount++;
            }

            if (delay <= 60) delayDistribution.on_time++;
            else if (delay <= 300) delayDistribution.delayed_1_to_5++;
            else delayDistribution.delayed_5_plus++;
            
            if (delay > 300 && p.route_short_name) {
                delayedVehicles.push({
                    vehicle_id: p.vehicle_id || p.vehicle_descriptor?.vehicle_registration_number?.toString() || 'N/A',
                    gtfs_trip_id: p.gtfs_trip_id || 'N/A',
                    line: p.route_short_name.toString(),
                    delay,
                    route_type: rType,
                    route_color: p.route_color || ''
                });
            }
        }
    }
    
    delayedVehicles.sort((a, b) => b.delay - a.delay);
    const most_delayed = delayedVehicles.slice(0, 20);
    
    const busiest_lines = Object.entries(lineCounts)
        .map(([line, data]) => ({ line, count: data.count, route_color: data.route_color }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
        
    return {
        total_vehicles: features.length,
        total_lines: lines.size,
        average_delay: delayCount > 0 ? delaySum / delayCount : null,
        total_delay_seconds: delaySum,
        low_floor_count: lowFloorCount,
        air_conditioned_count: airConditionedCount,
        delayed_over_5_min_count: delayedOver5MinCount,
        delay_distribution: delayDistribution,
        state_distribution: stateDistribution,
        vehicle_types: vehicleTypes,
        busiest_lines,
        most_delayed,
        timestamp: new Date().toISOString()
    };
}
