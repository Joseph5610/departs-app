
import { useMemo } from 'react';
import type { VehicleDetail } from '../types/transit';

export const useRouteShape = (selectedVehicle: any, vehicleDetail: VehicleDetail | undefined) => {
    const vId = selectedVehicle?.vehicle_id || selectedVehicle?.id;
    const tId = vehicleDetail?.gtfs_trip_id || selectedVehicle?.gtfs_trip_id;

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
    }, [vId, tId, vehicleDetail?.shapes]);
};
