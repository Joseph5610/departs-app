
import { useMemo } from 'react';
import { useVehicleDetail } from './useVehicleDetail';
import { useSelectedVehicle } from './useSelectedVehicle';
import { getVehicleColor, isNightRoute } from '../utils/vehicleColors';

export const useRouteShape = () => {
    const { data: vehicleDetail } = useVehicleDetail();
    const selectedVehicle = useSelectedVehicle();

    return useMemo(() => {
        if (!selectedVehicle || !vehicleDetail?.shapes || !Array.isArray(vehicleDetail.shapes)) {
            return null;
        }

        const coordinates = vehicleDetail.shapes as [number, number][];
        if (coordinates.length < 2) {
            return null;
        }

        const routeName = selectedVehicle.route_short_name || '';
        const routeType = selectedVehicle.route_type || 0;
        const color = isNightRoute(routeName) ? '#ffffff' : getVehicleColor(routeType, routeName);

        return {
            type: 'FeatureCollection' as const,
            features: [{
                type: 'Feature' as const,
                geometry: {
                    type: 'LineString' as const,
                    coordinates: coordinates
                },
                properties: {
                    line_color: color
                }
            }]
        };
    }, [selectedVehicle, vehicleDetail]);
};
