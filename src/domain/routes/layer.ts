import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import type { VehicleDetail, StopTimeFeature } from '@/types';
import { locateStops, measureLine, resolveProgress, splitLineAt, type MeasuredLine } from './progress';

/** A trip's drawn shape and, where the network publishes them, each point's shape distance. */
export interface TripShape {
    coordinates: [number, number][];
    distances: number[] | null;
}

/**
 * The route layer of a trip: its line - the real shape when one is known, else straight between its
 * stops once the shape is known to be missing - followed by its stops, the first and last marked as terminals.
 * The shape line is drawn as soon as it arrives, before the trip's stops (from its detail) are known.
 */
export function buildRouteLayer(detail: VehicleDetail | undefined, routeColor: string, shape: TripShape | null, isShapeLoading: boolean): FeatureCollection | null {
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

/** The route line measured in metres, with each stop's distance along it. */
export interface MeasuredRoute {
    line: MeasuredLine;
    stopAlong: number[];
    stopIndexBySequence: Map<number, number>;
}

export function measureRoute(lineFeature: Feature<LineString>, stops: StopTimeFeature[]): MeasuredRoute {
    const line = measureLine(lineFeature.geometry.coordinates as [number, number][]);
    const stopIndexBySequence = new Map(stops.map((st, i) => [st.properties.stop_sequence, i]));
    return { line, stopAlong: locateStops(line, stops.map(st => st.geometry?.coordinates ?? null)), stopIndexBySequence };
}

/** Where the selected vehicle is, for splitting its route. */
export interface VehicleOnRoute {
    shapeDistances?: number[];
    reportedDistance?: number;
    statePosition?: string;
    lastStopSequence?: number | null;
    position: [number, number] | null;
}

/**
 * The route layer with its line split into `traversed` and `upcoming` at the vehicle. Returns `layer`
 * itself before the trip starts or when the vehicle cannot be placed on the line.
 */
export function splitRouteAtVehicle(layer: FeatureCollection, lineFeature: Feature<LineString> | undefined, measured: MeasuredRoute | null, vehicle: VehicleOnRoute): FeatureCollection {
    if (!lineFeature || !measured) return layer;
    if (vehicle.statePosition === 'before_track' || vehicle.statePosition === 'before_track_delayed') return layer;

    const { lastStopSequence } = vehicle;
    const progress = resolveProgress(measured.line, measured.stopAlong, {
        shapeDistances: vehicle.shapeDistances,
        reportedDistance: vehicle.reportedDistance,
        stopIndex: lastStopSequence != null ? measured.stopIndexBySequence.get(Number(lastStopSequence)) ?? null : null,
        position: vehicle.position,
    });
    if (progress === null || progress <= 0) return layer;

    const otherFeatures = layer.features.filter(f => f !== lineFeature);
    const props = lineFeature.properties;
    const lineOf = (coordinates: LineString['coordinates'], status: 'traversed' | 'upcoming'): Feature<LineString> => (
        { type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: { ...props, status } }
    );

    // A one-point "upcoming" line is invalid GeoJSON, so a finished shape is all traversed.
    const total = measured.line.along[measured.line.along.length - 1];
    if (progress >= total) return { type: 'FeatureCollection', features: [lineOf(lineFeature.geometry.coordinates, 'traversed'), ...otherFeatures] };

    const { traversed, upcoming } = splitLineAt(measured.line, progress);
    return { type: 'FeatureCollection', features: [lineOf(traversed, 'traversed'), lineOf(upcoming, 'upcoming'), ...otherFeatures] };
}
