import type { AppVehicleCollection } from '../types';
import { parseBoundsParam } from '../schemas';
import { isInView, vehicleView } from '../../../shared/vehicleView';

/** Whether a query asks for the whole fleet, which is answered from the serialized collection. */
export function isUnfiltered({ bounds, routeType, routeShortName }: VehicleFilter): boolean {
    return !bounds && !routeType?.length && !routeShortName?.length;
}

export interface VehicleFilter {
    bounds?: string | null;
    routeType?: string[];
    routeShortName?: string[];
}

/**
 * Narrows a city's full vehicle collection to one map view: route types, line names and bounds
 * (`south,west,north,east`). Vehicles without a position are dropped only when bounds are given.
 */
export function filterVehicles(collection: AppVehicleCollection, { bounds, routeType, routeShortName }: VehicleFilter): AppVehicleCollection {
    const view = vehicleView(routeType, routeShortName, bounds ? parseBoundsParam(bounds) : null);
    return {
        type: 'FeatureCollection',
        features: view ? collection.features.filter(f => isInView(view, f)) : collection.features,
        status: collection.status,
        ...(collection.last_updated !== undefined ? { last_updated: collection.last_updated } : {}),
    };
}
