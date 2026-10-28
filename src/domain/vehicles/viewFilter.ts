import type { VehicleCollection, VehicleFeature } from '@/types';
import type { AppVehicleCollection, AppVehicleFeature } from '@shared/api';
import { isInView, vehicleView } from '@shared/vehicleView';
import { hasPosition } from '@/lib/geo';

const isPlaced = (f: AppVehicleFeature): f is VehicleFeature => hasPosition(f.geometry?.coordinates);

/** The fleet as the API sends it, without the vehicles it has no position for (or the feeds' `[0, 0]`): nothing in the app can place them. */
export const withPositions = (collection: AppVehicleCollection): VehicleCollection =>
    collection.features.every(isPlaced)
        ? collection as VehicleCollection
        : { ...collection, features: collection.features.filter(isPlaced) };

/** Narrows the city-wide fleet to one map view: route types, line names and `south,west,north,east` bounds. */
export function filterVehiclesToView(
    collection: VehicleCollection | null | undefined,
    bounds: string | null,
    routeFilter: string[] | null,
    routeTypeFilter: string[]
): VehicleCollection | null | undefined {
    if (!collection) return collection;
    const box = bounds ? bounds.split(',').map(Number) : null;
    const view = vehicleView(routeTypeFilter, routeFilter, box?.length === 4 && box.every(Number.isFinite) ? [box[0], box[1], box[2], box[3]] : null);
    return view ? { ...collection, features: collection.features.filter(f => isInView(view, f)) } : collection;
}
