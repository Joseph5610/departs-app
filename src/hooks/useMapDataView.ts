
import { useMemo } from 'react';
import { useVehicles } from './useVehicles';
import { useVehicleDetail } from './useVehicleDetail';
import { useStops } from './useStops';
import { useDepartures } from './useDepartures';
import { useGroupedDepartures } from './useGroupedDepartures';
import { useRouteShape } from './useRouteShape';
import { useMapCentroids } from './useMapCentroids';
import { EMPTY_GEOJSON } from '../config/constants';
import type {
    TrackedVehicle,
    VehicleCollection,
    VehicleFeature,
    StopCollection
} from '../types/transit';

/**
 * Hook to aggregate all transit-related data queries and compute derived views.
 * Orchestrates fetching of vehicles, stops, and departures, and prepares them for map rendering.
 *
 * @param debouncedBounds - Current map viewport bounds for filtering vehicles.
 * @param selectedVehicle - Currently selected vehicle for detail fetching and shape rendering.
 * @param selectedStopId - Currently selected stop for departure board fetching.
 * @param departureSort - User preference for sorting departures.
 * @param routeFilter - List of route names to filter vehicles on the map.
 * @returns An object containing all transit data and derived GeoJSON objects.
 */
export const useMapDataView = (
    debouncedBounds: string | null,
    selectedVehicle: TrackedVehicle | null,
    selectedStopId: string | null,
    departureSort: 'line' | 'departure',
    routeFilter: string[] | null
) => {
    // Identify the trip ID of the vehicle we are tracking (if any)
    const trackedId = useMemo(() => {
        if (!selectedVehicle) return null;
        return selectedVehicle.gtfs_trip_id || selectedVehicle.trip_id || null;
    }, [selectedVehicle]);

    const selectedId = useMemo(() =>
        selectedVehicle?.vehicle_id || selectedVehicle?.id || null,
    [selectedVehicle]);

    // Data Queries
    const {
        data: rawVehicles,
        isFetching: fetchingVehicles,
        dataUpdatedAt
    } = useVehicles(debouncedBounds, trackedId, routeFilter);

    const {
        data: vehicleDetail,
        isFetching: loadingDetail
    } = useVehicleDetail(
        selectedId,
        trackedId
    );

    const { data: stops } = useStops();
    const { data: departures, isLoading: loadingDeps } = useDepartures(selectedStopId);

    // Derived State
    const groupedDepartures = useGroupedDepartures(departures, departureSort);
    const routeShapeData = useRouteShape(selectedVehicle, vehicleDetail);

    const displayVehicles = useMemo((): VehicleCollection => {
        if (!rawVehicles?.features) return EMPTY_GEOJSON as VehicleCollection;
        return rawVehicles as VehicleCollection;
    }, [rawVehicles]);

    const selectedVehicleFeature = useMemo((): VehicleCollection => {
        if (!selectedVehicle || !selectedVehicle._geometry) return EMPTY_GEOJSON as VehicleCollection;

        return {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: selectedVehicle._geometry
                    },
                    properties: {
                        ...selectedVehicle,
                        route_type: selectedVehicle.route_type,
                        gtfs_route_short_name: selectedVehicle.gtfs_route_short_name || selectedVehicle.route_short_name
                    }
                } as VehicleFeature
            ]
        };
    }, [selectedVehicle]);

    const stopsData = useMemo(() => {
        if (!stops) return null;
        return {
            type: 'FeatureCollection',
            features: stops.features.filter(f => !f.properties.is_centroid)
        } as StopCollection;
    }, [stops]);

    const labelData = useMapCentroids(stops || null);

    return {
        rawVehicles,
        fetchingVehicles,
        dataUpdatedAt,
        vehicleDetail,
        loadingDetail,
        stops,
        loadingDeps,
        groupedDepartures,
        routeShapeData,
        displayVehicles,
        selectedVehicleFeature,
        stopsData,
        labelData,
        selectedId
    };
};
