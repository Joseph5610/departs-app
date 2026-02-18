
import { useMemo } from 'react';
import type { LineLayerSpecification, FilterSpecification } from 'maplibre-gl';
import { isNightRoute, getVehicleColor } from '../utils/vehicleColors';
import type { TrackedVehicle } from '../types/transit';

/**
 * Manages memoized map styles, colors, and filters to keep Map.tsx clean.
 */
export const useMapStyles = (selectedVehicle: TrackedVehicle | null, selectedId: string | number | null) => {

    // Memoize route line color to prevent re-computation on every render
    const routeLineColor = useMemo(() => {
        const routeName = selectedVehicle?.gtfs_route_short_name || selectedVehicle?.route_short_name || '';
        const routeType = selectedVehicle?.route_type || 0;
        return isNightRoute(routeName) ? '#ffffff' : getVehicleColor(routeType, routeName);
    }, [selectedVehicle?.gtfs_route_short_name, selectedVehicle?.route_short_name, selectedVehicle?.route_type]);

    // Memoize route line paint object
    const routeLinePaint = useMemo((): LineLayerSpecification['paint'] => ({
        'line-color': routeLineColor,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 15, 8],
        'line-opacity': 0.8,
        'line-blur': 0.5
    }), [routeLineColor]);

    // Memoize route line layout object
    const routeLineLayout = useMemo(() => ({
        'line-join': 'round' as const,
        'line-cap': 'round' as const
    }), []);

    // Memoize vehicle filter to exclude selected vehicle from the main vehicles layer
    const vehiclesFilter = useMemo((): FilterSpecification => ['!', ['any',
        ['==', ['to-string', ['coalesce', ['get', 'vehicle_id'], ['get', 'id'], '']], String(selectedId || 'NOMATCH')],
        ['==', ['to-string', ['coalesce', ['get', 'gtfs_trip_id'], ['get', 'trip_id'], '']], String(selectedVehicle?.gtfs_trip_id || selectedVehicle?.trip_id || 'NOMATCH')]
    ]], [selectedId, selectedVehicle?.gtfs_trip_id, selectedVehicle?.trip_id]);

    return {
        routeLinePaint,
        routeLineLayout,
        vehiclesFilter
    };
};
