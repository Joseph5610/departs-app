import { useMemo } from 'react';
import { useVehicleDetail } from '../data/useVehicleDetail';
import { useSelectedVehicle } from './useSelectedVehicle';
import type { FeatureCollection, LineString } from 'geojson';

export const useRouteShape = () => {
    const { data: vehicleDetail } = useVehicleDetail();
    const selectedVehicle = useSelectedVehicle();

    return useMemo(() => {
        if (!selectedVehicle || !vehicleDetail?.route_geojson) {
            return null;
        }

        const geojson = vehicleDetail.route_geojson as FeatureCollection<LineString>;
        if (!geojson.features || geojson.features.length === 0) {
            return null;
        }

        // The backend now provides line_color directly in the first feature's properties
        const color = geojson.features[0].properties?.line_color || '#AD0B00';

        // Ensure all segments have the correct color injected (safety)
        return {
            ...geojson,
            features: geojson.features.map(feature => ({
                ...feature,
                properties: {
                    ...feature.properties,
                    line_color: color
                }
            }))
        };
    }, [selectedVehicle, vehicleDetail]);
};
