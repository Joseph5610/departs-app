
import { useMemo } from 'react';
import { useMap } from '../hooks/useMap';
import { useVehicleDetail } from './useVehicleDetail';
import { getVehicleColor, isNightRoute } from '../utils/vehicleColors';

export const useRouteShape = () => {
    const { state } = useMap();
    const { data: vehicleDetail } = useVehicleDetail();
    const vId = state.selectedId;

    return useMemo(() => {
        if (!vId || !vehicleDetail?.shapes || !Array.isArray(vehicleDetail.shapes)) {
            return null;
        }

        const coordinates = vehicleDetail.shapes as [number, number][];
        if (coordinates.length < 2) {
            return null;
        }

        const routeName = state.selectedVehicle?.route_short_name || '';
        const routeType = state.selectedVehicle?.route_type || 0;
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
    }, [vId, vehicleDetail, state.selectedVehicle]);
};
