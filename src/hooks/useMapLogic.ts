
import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { MapRef } from 'react-map-gl/maplibre';

import { useMapState } from './useMapState';
import { useMapView } from './useMapView';
import { useMapDataView } from './useMapDataView';
import { useMapInteraction } from './useMapInteraction';

import { useGeolocation } from './useGeolocation';
import { useMapUrlSync } from './useMapUrlSync';
import { useMapAnimation } from './useMapAnimation';
import { useMapVehicleSync } from './useMapVehicleSync';

/**
 * Main orchestrator hook for the map logic.
 * Composes specialized hooks to manage state, view, data, and interactions.
 */
export const useMapLogic = (mapRef: React.RefObject<MapRef | null>) => {
    const queryClient = useQueryClient();

    // 1. Core State
    const mapState = useMapState();
    const {
        selectedStop, setSelectedStop,
        selectedVehicle, setSelectedVehicle,
        isFollowing, setIsFollowing,
        showVehicles, setShowVehicles,
        isSettingsOpen, setIsSettingsOpen,
        expandedGroups, setExpandedGroups,
        departureSort, setDepartureSort,
        routeFilter, setRouteFilter,
        toggleGroup
    } = mapState;

    // 2. Geolocation & Sync Hooks
    const { userLocation, handleLocate, performGeolocation } = useGeolocation(mapRef);

    // 3. View Management (Bounds, Move handlers)
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

    // 4. Data Fetching & Processing
    const mapData = useMapDataView(
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
    } = mapData;

    // 5. Interaction Handlers
    const interaction = useMapInteraction(
        mapRef,
        selectedVehicle,
        isFollowing,
        setIsFollowing,
        setSelectedVehicle,
        queryClient
    );

    const { onDragStart, handleDepartureClick } = interaction;

    // 6. Secondary Sync Hooks
    useMapUrlSync(selectedStop, setSelectedStop);
    useMapAnimation(mapRef, selectedVehicle, isFollowing);
    useMapVehicleSync(
        selectedId,
        selectedVehicle,
        setSelectedVehicle,
        isFollowing,
        displayVehicles,
        vehicleDetail
    );

    // Return flattened state for component consumption
    return useMemo(() => ({
        // State
        bounds, debouncedBounds, selectedStop, selectedVehicle, userLocation, isFollowing,
        showVehicles, isSettingsOpen, expandedGroups, departureSort, routeFilter,

        // Setters & Actions
        setSelectedStop, setSelectedVehicle, setIsFollowing, setShowVehicles, setIsSettingsOpen,
        setDepartureSort, handleLocate, onMove, onMoveEnd, onLoad, onDragStart,
        handleDepartureClick, toggleGroup, setExpandedGroups, setRouteFilter,

        // Data
        displayVehicles, selectedVehicleFeature, vehicleDetail, loadingDetail, stopsData, labelData,
        groupedDepartures, stops, loadingDeps, routeShapeData, fetchingVehicles, dataUpdatedAt,
        mapLoaded, selectedId, labelLayerId
    }), [
        bounds, debouncedBounds, selectedStop, selectedVehicle, userLocation, isFollowing,
        showVehicles, isSettingsOpen, expandedGroups, departureSort, routeFilter,
        handleLocate, onMove, onMoveEnd, onLoad, onDragStart, handleDepartureClick,
        displayVehicles, selectedVehicleFeature, vehicleDetail, loadingDetail, stopsData, labelData,
        groupedDepartures, stops, loadingDeps, routeShapeData, fetchingVehicles, dataUpdatedAt,
        mapLoaded, selectedId, labelLayerId, setSelectedStop, setSelectedVehicle, setIsFollowing,
        setShowVehicles, setIsSettingsOpen, setDepartureSort, toggleGroup, setExpandedGroups, setRouteFilter
    ]);
};
