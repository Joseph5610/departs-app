import { useMemo } from 'react';
import { useVehicleDetail } from '../data/useVehicleDetail';
import { useTripShape, type TripShape } from '../data/useTripShape';
import { useCityConfig } from '../data/useCities';
import { useRouteParams } from '../useRouteParams';
import { useSelectedVehicle } from './useSelectedVehicle';
import type { VehicleDetail } from '../../types/vehicles';
import type { FeatureCollection, Feature, LineString, Point } from 'geojson';

/**
 * The route layer of a trip: its line - the real shape when one is known, else straight between its
 * stops once the shape is known to be missing - followed by its stops, the first and last marked as terminals.
 * The shape line is drawn as soon as it arrives, before the trip's stops (from its detail) are known.
 */
function buildRoute(detail: VehicleDetail | undefined, routeColor: string, shape: TripShape | null, isShapeLoading: boolean): FeatureCollection | null {
    const stopPoints = (detail?.stop_times?.features ?? [])
        .map(st => st.geometry)
        .filter((g): g is Point & { coordinates: [number, number] } => g?.type === 'Point' && Array.isArray(g.coordinates));

    const features: Feature[] = [];
    const lineCoordinates = shape?.coordinates ?? (isShapeLoading ? [] : stopPoints.map(g => g.coordinates));
    if (lineCoordinates.length > 1) {
        features.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: lineCoordinates },
            properties: { route_color: routeColor, ...(shape?.distances ? { shape_dist_traveled: shape.distances } : {}) },
        });
    }
    stopPoints.forEach((geometry, index) => {
        features.push({
            type: 'Feature',
            geometry,
            properties: { route_color: routeColor, is_terminal: index === 0 || index === stopPoints.length - 1 },
        });
    });
    return features.length > 0 ? { type: 'FeatureCollection', features } : null;
}

export const useRouteShape = (): FeatureCollection | null => {
    const { data: vehicleDetail } = useVehicleDetail();
    const selectedVehicle = useSelectedVehicle();
    const hasTripShapes = Boolean(useCityConfig().hasTripShapes);
    const { tripId } = useRouteParams();
    const { shape: tripShape, isLoading: isShapeLoading } = useTripShape(tripId);

    const routeColor = vehicleDetail?.route_color || selectedVehicle?.route_color || '';
    const geojson = useMemo(
        () => (hasTripShapes && (vehicleDetail || tripShape) ? buildRoute(vehicleDetail, routeColor, tripShape, isShapeLoading) : null),
        [vehicleDetail, routeColor, hasTripShapes, tripShape, isShapeLoading],
    );

    const hasSelection = !!selectedVehicle;
    const vDist = vehicleDetail?.shape_dist_traveled;
    const statePos = vehicleDetail?.state_position ?? selectedVehicle?.state_position;
    const pos = vehicleDetail?.geometry?.coordinates ?? selectedVehicle?.geometry?.coordinates;
    const posLng = pos?.[0];
    const posLat = pos?.[1];

    return useMemo(() => {
        if (!hasSelection || !geojson) return null;

        const lineFeature = geojson.features.find(f => f.geometry?.type === 'LineString') as Feature<LineString> | undefined;
        if (!lineFeature) return geojson;

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
        } else if (posLng !== undefined && posLat !== undefined) {
            let minDist = Infinity;
            coords.forEach(([lng, lat], i) => {
                const dist = (lng - posLng) ** 2 + (lat - posLat) ** 2;
                if (dist < minDist) { minDist = dist; splitIdx = i; }
            });
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
    }, [hasSelection, geojson, vDist, statePos, posLng, posLat]);
};
