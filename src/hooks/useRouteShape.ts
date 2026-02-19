
import { useMemo } from 'react';
import { useMap } from '../hooks/useMap';
import { useVehicleDetail } from './useVehicleDetail';

export const useRouteShape = () => {
    const { state } = useMap();
    const { data: vehicleDetail } = useVehicleDetail();
    const vId = state.selectedId;

    return useMemo(() => {
        if (!vId || !vehicleDetail?.shapes || !Array.isArray(vehicleDetail.shapes)) return null;

        const coordinates = vehicleDetail.shapes as [number, number][];

        if (coordinates.length < 2) return null;

        return {
            type: 'FeatureCollection' as const,
            features: [{
                type: 'Feature' as const,
                geometry: {
                    type: 'LineString' as const,
                    coordinates: coordinates
                },
                properties: {}
            }]
        };
    }, [vId, vehicleDetail]);
};
