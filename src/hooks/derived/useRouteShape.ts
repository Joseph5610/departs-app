import { useMemo } from 'react';
import { useVehicleDetail } from '../data/useVehicleDetail';
import { useSelectedVehicle } from './useSelectedVehicle';
import type { FeatureCollection, Feature, LineString } from 'geojson';

export const useRouteShape = (): FeatureCollection | null => {
    const { data: vehicleDetail } = useVehicleDetail();
    const selectedVehicle = useSelectedVehicle();

    return useMemo(() => {
        const geojson = vehicleDetail?.route_geojson as FeatureCollection | undefined;
        if (!selectedVehicle || !geojson?.features?.length) return null;

        const lineFeature = geojson.features.find(f => f.geometry?.type === 'LineString') as Feature<LineString> | undefined;
        if (!lineFeature) return geojson;

        const vDist = vehicleDetail?.shape_dist_traveled;
        const statePos = vehicleDetail?.state_position ?? selectedVehicle.state_position;

        // Unstarted trip, missing distance, or before_track => render entire line as upcoming
        if (vDist === undefined || vDist === 0 || statePos === 'before_track' || statePos === 'before_track_delayed') {
            return geojson;
        }

        const coords = lineFeature.geometry.coordinates;
        const shapeDists = lineFeature.properties?.shape_dist_traveled as number[] | undefined;

        let splitIdx = shapeDists
            ? shapeDists.findIndex(d => d > vDist) - 1
            : -1;

        if (splitIdx < 0 && !shapeDists) {
            const pos = vehicleDetail?.geometry?.coordinates ?? selectedVehicle.geometry?.coordinates;
            if (pos) {
                let minDist = Infinity;
                coords.forEach(([lng, lat], i) => {
                    const dist = (lng - pos[0]) ** 2 + (lat - pos[1]) ** 2;
                    if (dist < minDist) { minDist = dist; splitIdx = i; }
                });
            }
        }

        if (splitIdx <= 0) return geojson;

        const otherFeatures = geojson.features.filter(f => f !== lineFeature);
        const props = lineFeature.properties;

        return {
            type: 'FeatureCollection',
            features: [
                { type: 'Feature', geometry: { type: 'LineString', coordinates: coords.slice(0, splitIdx + 1) }, properties: { ...props, status: 'traversed' } },
                { type: 'Feature', geometry: { type: 'LineString', coordinates: coords.slice(splitIdx) }, properties: { ...props, status: 'upcoming' } },
                ...otherFeatures
            ]
        };
    }, [selectedVehicle, vehicleDetail]);
};
