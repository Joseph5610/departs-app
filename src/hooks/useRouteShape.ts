
import { useMemo } from 'react';

export const useRouteShape = (selectedVehicle: any, vehicleDetail: any) => {
    return useMemo(() => {
        if (!selectedVehicle || !vehicleDetail?.shapes || !Array.isArray(vehicleDetail.shapes)) return null;

        const coordinates = vehicleDetail.shapes;

        if (coordinates.length < 2) return null;

        return {
            type: 'FeatureCollection' as const,
            features: [{
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: coordinates
                },
                properties: {}
            }]
        };
    }, [selectedVehicle, vehicleDetail]);
};
