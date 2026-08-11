import { useMemo } from 'react';
import type { FilterSpecification } from 'maplibre-gl';
import type { VehicleDetail, VehicleCollection, VehicleFeature } from '../../types/transit';
import { getDelayFilterExpression } from '../../config/mapLayers';

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
    selectedId: string | null | undefined,
    delayFilter: string[] = []
) => {
    // 1. Create a standalone GeoJSON for the selected vehicle
    const selectedVehicleFeature = useMemo((): VehicleCollection => {
        if (!selectedVehicle || !selectedVehicle.geometry) {
            return EMPTY_GEOJSON;
        }

        const coords = selectedVehicle.geometry.coordinates;
        const [lng, lat] = coords;
        const hasValidLocation = lng !== 0 || lat !== 0;

        return {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: hasValidLocation ? coords : [0, 0]
                    },
                    properties: {
                        ...selectedVehicle
                    }
                } as VehicleFeature
            ]
        };
    }, [selectedVehicle]);

    // 2. Create a filter to hide the selected vehicle from the main stream layer
    // and filter by delay range when delayFilter is active.
    const vehiclesFilter = useMemo<FilterSpecification>(() => {
        const baseExcludeFilter = ['!', ['any',
            ['==', ['to-string', ['coalesce', ['get', 'vehicle_id'], '']], selectedId || 'NOMATCH'],
            ['==', ['to-string', ['coalesce', ['get', 'gtfs_trip_id'], '']], selectedVehicle?.gtfs_trip_id || 'NOMATCH']
        ]];

        const delayExpr = getDelayFilterExpression(delayFilter);

        if (!delayExpr) {
            return baseExcludeFilter as unknown as FilterSpecification;
        }

        return ['all', baseExcludeFilter, delayExpr] as unknown as FilterSpecification;
    }, [selectedId, selectedVehicle?.gtfs_trip_id, delayFilter]);

    return {
        selectedVehicleFeature,
        vehiclesFilter
    };
};
