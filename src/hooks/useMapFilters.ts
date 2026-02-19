import { useMemo } from 'react';
import type { FilterSpecification } from 'maplibre-gl';
import type { TrackedVehicle, VehicleCollection, VehicleFeature } from '../types/transit';

const EMPTY_GEOJSON: VehicleCollection = {
    type: 'FeatureCollection',
    features: []
};

/**
 * Provides memoized GeoJSON and filter expressions for map layers.
 */
export const useMapFilters = (
    selectedVehicle: TrackedVehicle | null,
    selectedId: string | null
) => {
    const selectedVehicleFeature = useMemo((): VehicleCollection => {
        if (!selectedVehicle || !selectedVehicle._geometry) return EMPTY_GEOJSON;

        return {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: selectedVehicle._geometry
                    },
                    properties: {
                        ...selectedVehicle,
                        route_type: selectedVehicle.route_type,
                        gtfs_route_short_name: selectedVehicle.gtfs_route_short_name || selectedVehicle.route_short_name
                    }
                } as unknown as VehicleFeature
            ]
        };
    }, [selectedVehicle]);

    const vehiclesFilter = useMemo<FilterSpecification>(() => ['!', ['any',
        ['==', ['to-string', ['coalesce', ['get', 'vehicle_id'], ['get', 'id'], '']], String(selectedId || 'NOMATCH')],
        ['==', ['to-string', ['coalesce', ['get', 'gtfs_trip_id'], ['get', 'trip_id'], '']], String(selectedVehicle?.gtfs_trip_id || selectedVehicle?.trip_id || 'NOMATCH')]
    ]] as FilterSpecification, [selectedId, selectedVehicle?.gtfs_trip_id, selectedVehicle?.trip_id]);

    return {
        selectedVehicleFeature,
        vehiclesFilter
    };
};
