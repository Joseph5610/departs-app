
import { useMemo } from 'react';
import { useVehicleDetail } from '../data/useVehicleDetail';
import { useSelectedVehicle } from './useSelectedVehicle';

/**
 * useRouteShape
 *
 * Provides the GeoJSON FeatureCollection for the selected vehicle's route shape.
 * Leverages the pre-formatted route_shape provided by the detail API.
 */
export const useRouteShape = () => {
    const { data: vehicleDetail } = useVehicleDetail();
    const selectedVehicle = useSelectedVehicle();

    return useMemo(() => {
        if (!selectedVehicle || !vehicleDetail?.properties?.route_shape) {
            return null;
        }

        return {
            type: 'FeatureCollection' as const,
            features: [vehicleDetail.properties.route_shape]
        };
    }, [selectedVehicle, vehicleDetail]);
};
