import type { VehicleCollection } from '../types/transit';

/**
 * Narrows the city-wide fleet to one map view: route types, line names and `south,west,north,east`
 * bounds. Same rules as the backend's `filterVehicles`, which the map no longer asks it to apply.
 */
export function filterVehiclesToView(
    collection: VehicleCollection | null | undefined,
    bounds: string | null,
    routeFilter: string[] | null,
    routeTypeFilter: string[]
): VehicleCollection | null | undefined {
    if (!collection) return collection;

    const types = routeTypeFilter.length > 0 ? new Set(routeTypeFilter.map(r => r.toLowerCase())) : null;
    const names = routeFilter && routeFilter.length > 0 ? new Set(routeFilter.map(r => r.toUpperCase())) : null;
    const box = bounds ? bounds.split(',').map(Number) : null;
    const hasBox = !!box && box.length === 4 && box.every(Number.isFinite);

    if (!types && !names && !hasBox) return collection;

    const [minLat, minLng, maxLat, maxLng] = hasBox ? box : [0, 0, 0, 0];
    const features = collection.features.filter(f => {
        if (types && !types.has(f.properties.route_type)) return false;
        if (names && !names.has(String(f.properties.route_short_name).toUpperCase())) return false;
        if (hasBox) {
            const coords = f.geometry?.coordinates;
            if (!coords) return false;
            const [lng, lat] = coords;
            if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) return false;
        }
        return true;
    });

    return { ...collection, features };
}
