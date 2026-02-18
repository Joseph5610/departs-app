
import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { MapRef } from 'react-map-gl/maplibre';

import { useMapReducer } from './useMapReducer';
import { useMapView } from './useMapView';
import { useTransitData } from './useTransitData';
import { useMapController } from './useMapController';
import type { TrackedVehicle } from '../types/transit';

import { useGeolocation } from './useGeolocation';
import { useMapUrlSync } from './useMapUrlSync';
import { useMapAnimation } from './useMapAnimation';
import { useMapVehicleSync } from './useMapVehicleSync';

/**
 * Main orchestrator hook for the map logic.
 * Composes specialized hooks into a unified interface for the Map component.
 */
export const useMapLogic = (mapRef: React.RefObject<MapRef | null>) => {
    const queryClient = useQueryClient();

    // 1. Core State (Reducer)
    const { state, dispatch, toggleGroup } = useMapReducer();
    const {
        selectedStop,
        selectedVehicle,
        isFollowing,
        departureSort,
        routeFilter,
    } = state;

    // 2. Geolocation
    const { userLocation, handleLocate, performGeolocation } = useGeolocation(mapRef);

    // 3. View Management (Camera, Bounds)
    const mapView = useMapView(isFollowing, performGeolocation);
    const {
        mapLoaded,
        bounds,
        debouncedBounds,
        labelLayerId,
        onMove,
        onMoveEnd,
        onLoad
    } = mapView;

    // 4. Data Fetching (Queries)
    const transitData = useTransitData(
        debouncedBounds,
        selectedVehicle,
        selectedStop?.id || null,
        departureSort,
        routeFilter
    );

    const {
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
    } = transitData;

    // 5. Interaction Controller
    const controller = useMapController(
        mapRef,
        dispatch,
        selectedVehicle,
        isFollowing,
        queryClient
    );

    const { onMapClick, onDragStart, handleDepartureClick } = controller;

    // 6. Secondary Sync Hooks
    useMapUrlSync(selectedStop, (stop) => dispatch({ type: 'SET_STOP', stop }));
    useMapAnimation(mapRef, selectedVehicle, isFollowing);

    useMapVehicleSync(
        selectedId,
        selectedVehicle,
        (vehicle) => vehicle && dispatch({ type: 'UPDATE_SELECTED_VEHICLE', vehicle }),
        isFollowing,
        displayVehicles,
        vehicleDetail
    );

    // Return flattened state for component consumption
    return useMemo(() => ({
        // State
        ...state,
        userLocation,

        // Actions (Wrappers for dispatch for component convenience)
        setSelectedStop: (stop: { id: string; name: string } | null) => dispatch({ type: 'SET_STOP', stop }),
        setSelectedVehicle: (vehicle: TrackedVehicle | null) => dispatch({ type: 'SET_VEHICLE', vehicle }),
        setIsFollowing: (following: boolean | ((prev: boolean) => boolean)) => {
            const next = typeof following === 'function' ? following(isFollowing) : following;
            dispatch({ type: 'SET_FOLLOWING', following: next });
        },
        setShowVehicles: (show: boolean) => dispatch({ type: 'TOGGLE_VEHICLES', show }),
        setIsSettingsOpen: (open: boolean) => dispatch({ type: 'TOGGLE_SETTINGS', open }),
        setDepartureSort: (sort: 'line' | 'departure') => dispatch({ type: 'SET_SORT', sort }),
        setRouteFilter: (routes: string[] | null) => dispatch({ type: 'SET_ROUTE_FILTER', routes }),
        setExpandedGroups: (groups: string[]) => dispatch({ type: 'SET_EXPANDED_GROUPS', groups }),
        resetSelection: () => dispatch({ type: 'RESET_SELECTION' }),
        toggleGroup,
        handleLocate,
        dispatch,

        // View
        bounds, debouncedBounds, mapLoaded, labelLayerId,
        onMove, onMoveEnd, onLoad,

        // Data
        displayVehicles, selectedVehicleFeature, vehicleDetail, loadingDetail,
        stopsData, labelData, groupedDepartures, stops, loadingDeps,
        routeShapeData, fetchingVehicles, dataUpdatedAt, selectedId,

        // Interaction
        onMapClick, onDragStart, handleDepartureClick
    }), [
        state, isFollowing, dispatch, toggleGroup, userLocation, handleLocate,
        bounds, debouncedBounds, mapLoaded, labelLayerId, onMove, onMoveEnd, onLoad,
        displayVehicles, selectedVehicleFeature, vehicleDetail, loadingDetail,
        stopsData, labelData, groupedDepartures, stops, loadingDeps,
        routeShapeData, fetchingVehicles, dataUpdatedAt, selectedId,
        onMapClick, onDragStart, handleDepartureClick
    ]);
};
