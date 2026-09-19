import type { AppVehicleCollection } from '../types';
import { parseBoundsParam } from '../schemas';

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
    const types = routeType && routeType.length > 0 ? new Set(routeType.map(r => r.toLowerCase())) : null;
    const names = routeShortName && routeShortName.length > 0 ? new Set(routeShortName.map(r => r.toUpperCase())) : null;
    const box = bounds ? parseBoundsParam(bounds) : null;

    const features = (types || names || box)
        ? collection.features.filter(f => {
            if (types && !types.has(f.properties.route_type)) return false;
            if (names && !names.has(f.properties.route_short_name.toString().toUpperCase())) return false;
            if (box) {
                if (!f.geometry || !f.geometry.coordinates) return false;
                const [lng, lat] = f.geometry.coordinates;
                const [minLat, minLng, maxLat, maxLng] = box;
                if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) return false;
            }
            return true;
        })
        : collection.features;

    return {
        type: 'FeatureCollection',
        features,
        status: collection.status,
        ...(collection.last_updated !== undefined ? { last_updated: collection.last_updated } : {}),
    };
}
