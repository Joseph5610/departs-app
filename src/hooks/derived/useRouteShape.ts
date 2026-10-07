import { useMemo } from 'react';
import { useVehicleDetail } from '@/hooks/data/useVehicleDetail';
import { useTripShape } from '@/hooks/data/useTripShape';
import { useRouteParams } from '@/hooks/useRouteParams';
import { useSelectedVehicle } from './useSelectedVehicle';
import { buildRouteLayer, measureRoute, splitRouteAtVehicle } from '@/domain/routes';
import type { FeatureCollection, Feature, LineString } from 'geojson';

export const useRouteShape = (): FeatureCollection | null => {
    const { data: vehicleDetail } = useVehicleDetail();
    const selectedVehicle = useSelectedVehicle();
    const { tripId } = useRouteParams();
    const { shape: tripShape, isLoading: isShapeLoading } = useTripShape(tripId);

    const routeColor = vehicleDetail?.route_color || selectedVehicle?.route_color || '';
    const geojson = useMemo(
        () => (vehicleDetail || tripShape ? buildRouteLayer(vehicleDetail, routeColor, tripShape, isShapeLoading) : null),
        [vehicleDetail, routeColor, tripShape, isShapeLoading],
    );

    const lineFeature = useMemo(
        () => geojson?.features.find(f => f.geometry?.type === 'LineString') as Feature<LineString> | undefined,
        [geojson],
    );
    const shapeDistances = lineFeature?.properties?.shape_dist_traveled as number[] | undefined;

    const stopTimes = vehicleDetail?.stop_times?.features;
    const measured = useMemo(() => (lineFeature ? measureRoute(lineFeature, stopTimes ?? []) : null), [lineFeature, stopTimes]);

    const hasSelection = !!selectedVehicle;
    const reportedDistance = vehicleDetail?.shape_dist_traveled;
    const statePos = vehicleDetail?.state_position ?? selectedVehicle?.state_position;
    const lastSeq = selectedVehicle?.last_stop_sequence ?? vehicleDetail?.last_stop_sequence;
    const pos = vehicleDetail?.geometry?.coordinates ?? selectedVehicle?.geometry?.coordinates;
    const posLng = pos?.[0];
    const posLat = pos?.[1];

    return useMemo(() => {
        if (!hasSelection || !geojson) return null;
        return splitRouteAtVehicle(geojson, lineFeature, measured, {
            shapeDistances,
            reportedDistance,
            statePosition: statePos,
            lastStopSequence: lastSeq,
            position: posLng !== undefined && posLat !== undefined ? [posLng, posLat] : null,
        });
    }, [hasSelection, geojson, lineFeature, measured, shapeDistances, reportedDistance, statePos, lastSeq, posLng, posLat]);
};
