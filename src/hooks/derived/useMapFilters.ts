import { useMemo } from 'react';
import type { FilterSpecification } from 'maplibre-gl';
import type { VehicleDetail, VehicleCollection } from '../../types/transit';

const EMPTY_GEOJSON: VehicleCollection = {
    type: 'FeatureCollection',
    features: []
};

/**
 * Provides memoized GeoJSON and filter expressions for map layers.
 *
 * useMapFilters separates the rendering of the "selected vehicle" from
 * the main vehicle stream to allow for different styling and animations.
 */
export const useMapFilters = (
    selectedVehicle: VehicleDetail | null,
    selectedId: string | null
) => {
    // 1. Return the selected vehicle wrapped in a collection for the map
    const selectedVehicleFeature = useMemo((): VehicleCollection => {
        if (!selectedVehicle) {
            return EMPTY_GEOJSON;
        }

        return {
            type: 'FeatureCollection',
            features: [selectedVehicle]
        };
    }, [selectedVehicle]);

    // 2. Create a filter to hide the selected vehicle from the main stream layer
    // This prevents "double rendering" of the same vehicle.
    const vehiclesFilter = useMemo<FilterSpecification>(() => {
        return ['!', ['any',
            ['==', ['to-string', ['coalesce', ['get', 'vehicle_id'], ['get', 'id'], '']], selectedId || 'NOMATCH'],
            ['==', ['to-string', ['coalesce', ['get', 'gtfs_trip_id'], ['get', 'trip_id'], '']], selectedVehicle?.properties?.gtfs_trip_id || 'NOMATCH']
        ]] as FilterSpecification;
    }, [selectedId, selectedVehicle?.properties?.gtfs_trip_id]);

    return {
        selectedVehicleFeature,
        vehiclesFilter
    };
};
