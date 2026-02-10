
import { useMemo } from 'react';

export const useRouteShape = (selectedVehicle: any, vehicleDetail: any) => {
    const vId = selectedVehicle?.vehicle_id || selectedVehicle?.id;
    const tId = vehicleDetail?.gtfs_trip_id || vehicleDetail?.trip_id || selectedVehicle?.gtfs_trip_id;

    return useMemo(() => {
        if (!vId || !vehicleDetail?.shapes || !Array.isArray(vehicleDetail.shapes)) return null;

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
    }, [vId, tId, vehicleDetail?.shapes]);
};
