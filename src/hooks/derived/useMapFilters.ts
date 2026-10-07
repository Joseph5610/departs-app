import { useMemo } from 'react';
import type { FilterSpecification } from 'maplibre-gl';
import type { VehicleDetail, VehicleCollection, VehicleFeature } from '@/types';
import { getDelayFilterExpression } from '@/config/mapLayers';
import { EMPTY_FEATURE_COLLECTION } from '@/lib/geojson';

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
    const selectedVehicleFeature = useMemo((): VehicleCollection => {
        if (!selectedVehicle || !selectedVehicle.geometry) {
            return EMPTY_FEATURE_COLLECTION;
        }

        return {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: selectedVehicle.geometry.coordinates
                    },
                    // Only fields the layers and animation read: this feature is re-sent to the map worker every frame.
                    properties: {
                        vehicle_id: selectedVehicle.vehicle_id,
                        gtfs_trip_id: selectedVehicle.gtfs_trip_id,
                        route_short_name: selectedVehicle.route_short_name,
                        route_type: selectedVehicle.route_type,
                        route_color: selectedVehicle.route_color,
                        bearing: selectedVehicle.bearing,
                        delay: selectedVehicle.delay,
                        state_position: selectedVehicle.state_position ?? 'unknown',
                        origin_timestamp: selectedVehicle.origin_timestamp,
                    }
                } as VehicleFeature
            ]
        };
    }, [selectedVehicle]);

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
