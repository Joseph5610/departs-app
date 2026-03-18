import { useMemo } from 'react';
import type { FilterSpecification } from 'maplibre-gl';
import type { VehicleDetail, VehicleCollection, VehicleFeature } from '../types/transit';

const EMPTY_GEOJSON: VehicleCollection = {
    type: 'FeatureCollection',
    features: []
};

/**
 * Provides memoized GeoJSON and filter expressions for map layers.
 */
export const useMapFilters = (
    selectedVehicle: VehicleDetail | null,
    selectedId: string | null
) => {
    const selectedVehicleFeature = useMemo((): VehicleCollection => {
        const coords = selectedVehicle?.geometry?.coordinates;
        if (!selectedVehicle || !coords) return EMPTY_GEOJSON;

        const [lng, lat] = coords;
        const hasValidLocation = lng !== 0 || lat !== 0;

        return {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: hasValidLocation ? {
                        type: 'Point',
                        coordinates: coords
                    } : null,
                    properties: {
                        ...selectedVehicle,
                        route_type: selectedVehicle.route_type,
                        route_short_name: selectedVehicle.route_short_name
                    }
                } as unknown as VehicleFeature
            ]
        };
    }, [selectedVehicle]);

    const vehiclesFilter = useMemo<FilterSpecification>(() => ['!', ['any',
        ['==', ['to-string', ['coalesce', ['get', 'vehicle_id'], ['get', 'id'], '']], String(selectedId || 'NOMATCH')],
        ['==', ['to-string', ['coalesce', ['get', 'gtfs_trip_id'], ['get', 'trip_id'], '']], String(selectedVehicle?.gtfs_trip_id || 'NOMATCH')]
    ]] as FilterSpecification, [selectedId, selectedVehicle?.gtfs_trip_id]);

    return {
        selectedVehicleFeature,
        vehiclesFilter
    };
};
