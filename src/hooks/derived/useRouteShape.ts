import { useMemo } from 'react';
import { useVehicleDetail } from '../data/useVehicleDetail';
import { useTripShape, type TripShape } from '../data/useTripShape';
import { useRouteParams } from '../useRouteParams';
import { useSelectedVehicle } from './useSelectedVehicle';
import type { VehicleDetail } from '../../types/vehicles';
import { locateStops, measureLine, resolveProgress, splitLineAt } from '../../lib/routeProgress';
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
    const { tripId } = useRouteParams();
    const { shape: tripShape, isLoading: isShapeLoading } = useTripShape(tripId);

    const routeColor = vehicleDetail?.route_color || selectedVehicle?.route_color || '';
    const geojson = useMemo(
        () => (vehicleDetail || tripShape ? buildRoute(vehicleDetail, routeColor, tripShape, isShapeLoading) : null),
        [vehicleDetail, routeColor, tripShape, isShapeLoading],
    );

    const lineFeature = useMemo(
        () => geojson?.features.find(f => f.geometry?.type === 'LineString') as Feature<LineString> | undefined,
        [geojson],
    );
    const shapeDistances = lineFeature?.properties?.shape_dist_traveled as number[] | undefined;

    const stopTimes = vehicleDetail?.stop_times?.features;
    const measured = useMemo(() => {
        if (!lineFeature) return null;
        const line = measureLine(lineFeature.geometry.coordinates as [number, number][]);
        const stops = stopTimes ?? [];
        const stopIndexBySequence = new Map(stops.map((st, i) => [st.properties.stop_sequence, i]));
        return { line, stopAlong: locateStops(line, stops.map(st => st.geometry?.coordinates ?? null)), stopIndexBySequence };
    }, [lineFeature, stopTimes]);

    const hasSelection = !!selectedVehicle;
    const reportedDistance = vehicleDetail?.shape_dist_traveled;
    const statePos = vehicleDetail?.state_position ?? selectedVehicle?.state_position;
    const lastSeq = selectedVehicle?.last_stop_sequence ?? vehicleDetail?.last_stop_sequence;
    const pos = vehicleDetail?.geometry?.coordinates ?? selectedVehicle?.geometry?.coordinates;
    const posLng = pos?.[0];
    const posLat = pos?.[1];

    return useMemo(() => {
        if (!hasSelection || !geojson) return null;
        if (!lineFeature || !measured) return geojson;
        if (statePos === 'before_track' || statePos === 'before_track_delayed') return geojson;

        const progress = resolveProgress(measured.line, measured.stopAlong, {
            shapeDistances,
            reportedDistance,
            stopIndex: lastSeq != null ? measured.stopIndexBySequence.get(Number(lastSeq)) ?? null : null,
            position: posLng !== undefined && posLat !== undefined ? [posLng, posLat] : null,
        });
        if (progress === null || progress <= 0) return geojson;

        const otherFeatures = geojson.features.filter(f => f !== lineFeature);
        const props = lineFeature.properties;
        const lineOf = (coordinates: LineString['coordinates'], status: 'traversed' | 'upcoming'): Feature<LineString> => (
            { type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: { ...props, status } }
        );

        // A one-point "upcoming" line is invalid GeoJSON, so a finished shape is all traversed.
        const total = measured.line.along[measured.line.along.length - 1];
        if (progress >= total) return { type: 'FeatureCollection', features: [lineOf(lineFeature.geometry.coordinates, 'traversed'), ...otherFeatures] };

        const { traversed, upcoming } = splitLineAt(measured.line, progress);
        return { type: 'FeatureCollection', features: [lineOf(traversed, 'traversed'), lineOf(upcoming, 'upcoming'), ...otherFeatures] };
    }, [hasSelection, geojson, lineFeature, measured, shapeDistances, reportedDistance, statePos, lastSeq, posLng, posLat]);
};
