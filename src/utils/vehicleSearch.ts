import { VEHICLE_SEARCH } from '../config/constants';
import type { VehicleCollection, VehicleFeature } from '../types/transit';

/** The number riders see on a vehicle: the last segment of ids like `service-0-8414` or `train-19227`. */
export const vehicleDisplayNumber = (vehicleId: string): string => vehicleId.slice(vehicleId.lastIndexOf('-') + 1);

/** Live vehicles whose number or full id equals the query. */
export function searchVehicles(query: string, collection: VehicleCollection | null | undefined): VehicleFeature[] {
    const q = query.trim().toUpperCase();
    if (!collection || !VEHICLE_SEARCH.QUERY_SHAPE.test(q)) return [];

    const matches: VehicleFeature[] = [];
    for (const feature of collection.features) {
        const id = feature.properties.vehicle_id?.toUpperCase();
        if (!id || !feature.properties.gtfs_trip_id) continue;
        if (id === q || vehicleDisplayNumber(id) === q) {
            matches.push(feature);
            if (matches.length === VEHICLE_SEARCH.RESULT_LIMIT) break;
        }
    }
    return matches;
}
