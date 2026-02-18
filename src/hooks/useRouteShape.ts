
import { useMemo } from 'react';
import type { VehicleDetail, TrackedVehicle } from '../types/transit';

export const useRouteShape = (selectedVehicle: TrackedVehicle | null, vehicleDetail: VehicleDetail | null | undefined) => {
    const vId = selectedVehicle?.vehicle_id || selectedVehicle?.id;

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
