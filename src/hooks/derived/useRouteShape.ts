import { useMemo } from 'react';
import { useVehicleDetail } from '../data/useVehicleDetail';
import { useTripShape } from '../data/useTripShape';
import { useRouteParams } from '../useRouteParams';
import { useSelectedVehicle } from './useSelectedVehicle';
import type { FeatureCollection, Feature, LineString } from 'geojson';

/** The detail's route with its station-to-station line replaced by the trip's real shape, when one is known. */
function withTripShape(geojson: FeatureCollection | undefined, shape: [number, number][] | null): FeatureCollection | undefined {
    if (!geojson || !shape) return geojson;
    return {
        ...geojson,
        features: geojson.features.map(f => f.geometry?.type === 'LineString'
            ? { ...f, geometry: { type: 'LineString', coordinates: shape } }
            : f),
    };
}

export const useRouteShape = (): FeatureCollection | null => {
    const { data: vehicleDetail } = useVehicleDetail();
    const selectedVehicle = useSelectedVehicle();
    const { tripId } = useRouteParams();
    const tripShape = useTripShape(tripId);

    return useMemo(() => {
        const geojson = withTripShape(vehicleDetail?.route_geojson as FeatureCollection | undefined, tripShape);
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

        let splitIdx = -1;
        if (shapeDists) {
            const firstAhead = shapeDists.findIndex(d => d > vDist);
            // No point ahead of the vehicle: it has passed the whole shape.
            splitIdx = firstAhead === -1 ? coords.length - 1 : firstAhead - 1;
        } else {
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
        const traversed: Feature<LineString> = { type: 'Feature', geometry: { type: 'LineString', coordinates: coords.slice(0, splitIdx + 1) }, properties: { ...props, status: 'traversed' } };

        // A one-point "upcoming" line is invalid GeoJSON, so a finished shape is all traversed.
        if (splitIdx >= coords.length - 1) {
            return { type: 'FeatureCollection', features: [traversed, ...otherFeatures] };
        }

        return {
            type: 'FeatureCollection',
            features: [
                traversed,
                { type: 'Feature', geometry: { type: 'LineString', coordinates: coords.slice(splitIdx) }, properties: { ...props, status: 'upcoming' } },
                ...otherFeatures
            ]
        };
    }, [selectedVehicle, vehicleDetail, tripShape]);
};
