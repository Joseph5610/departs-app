import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useVehicles } from './useVehicles';
import { useVehicleDetail } from './useVehicleDetail';
import { useStops } from './useStops';
import { useDepartures } from './useDepartures';
import { useGeolocation } from './useGeolocation';
import { useGroupedDepartures } from './useGroupedDepartures';
import { useRouteShape } from './useRouteShape';
import { useMapAnimation } from './useMapAnimation';
import { useMapCentroids } from './useMapCentroids';
import { useMapUrlSync } from './useMapUrlSync';
import { useMapVehicleSync } from './useMapVehicleSync';
import { addAllIcons } from '../utils/mapIcons';
import { useMapReducer } from './useMapReducer';
import type { MapRef } from 'react-map-gl/maplibre';
import type { Map } from 'maplibre-gl';
import type { VehicleFeature, VehicleCollection, TrackedVehicle, StopCollection, Departure } from '../types/transit';
import {
    MAP_MIN_ZOOM_FOR_DATA,
    MAP_BOUNDS_DEBOUNCE,
    SIDEBAR_WIDTH,
    MOBILE_BREAKPOINT,
    MOBILE_BOTTOM_SHEET_RATIO,
    MAP_VEHICLE_SELECT_ZOOM,
    MAP_ANIMATION_DURATION
} from '../config/constants';

const EMPTY_GEOJSON: VehicleCollection = {
    type: 'FeatureCollection',
    features: []
};

/**
 * Main orchestration hook for map logic.
 * Manages state via useMapReducer and coordinates data fetching and map interactions.
 *
 * @param mapRef Reference to the MapLibre map instance
 */
export const useMapLogic = (mapRef: React.RefObject<MapRef | null>) => {
    const queryClient = useQueryClient();
    const [mapLoaded, setMapLoaded] = useState(false);
    const [labelLayerId, setLabelLayerId] = useState<string | undefined>(undefined);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const {
        state,
        setSelectedStop,
        setSelectedVehicle,
        setIsFollowing,
        setShowVehicles,
        setIsSettingsOpen,
        setExpandedGroups,
        toggleGroup,
        setDepartureSort,
        setRouteFilter,
        setBounds,
        setDebouncedBounds
    } = useMapReducer();

    // 1. Data Fetching
    const trackedId = useMemo(() => {
        if (!state.selectedVehicle) return null;
        return state.selectedVehicle.gtfs_trip_id || state.selectedVehicle.trip_id || null;
    }, [state.selectedVehicle]);

    const { data: rawVehicles, isFetching: fetchingVehicles, dataUpdatedAt } = useVehicles(
        state.debouncedBounds,
        trackedId,
        state.routeFilter
    );

    const selectedId = useMemo(() => state.selectedVehicle?.vehicle_id || state.selectedVehicle?.id || null, [state.selectedVehicle]);

    const { data: vehicleDetail, isFetching: loadingDetail } = useVehicleDetail(
        selectedId,
        trackedId
    );

    const { data: stops } = useStops();
    const { data: departures, isLoading: loadingDeps } = useDepartures(state.selectedStop?.id || null);

    // 2. Specialized Modular Sync Hooks
    const { userLocation, handleLocate, performGeolocation } = useGeolocation(mapRef);

    useMapUrlSync(state.selectedStop, setSelectedStop);
    useMapAnimation(mapRef, state.selectedVehicle, state.isFollowing);

    useMapVehicleSync(
        selectedId,
        state.selectedVehicle,
        setSelectedVehicle,
        state.isFollowing,
        rawVehicles as VehicleCollection,
        vehicleDetail
    );

    // 3. Derived State & Render Data
    const groupedDepartures = useGroupedDepartures(departures, state.departureSort);
    const routeShapeData = useRouteShape(state.selectedVehicle, vehicleDetail);

    const displayVehicles = useMemo((): VehicleCollection => {
        if (!rawVehicles?.features) return EMPTY_GEOJSON;
        return rawVehicles as VehicleCollection;
    }, [rawVehicles]);

    const selectedVehicleFeature = useMemo((): VehicleCollection => {
        if (!state.selectedVehicle || !state.selectedVehicle._geometry) return EMPTY_GEOJSON;

        return {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: state.selectedVehicle._geometry
                    },
                    properties: {
                        ...state.selectedVehicle,
                        route_type: state.selectedVehicle.route_type,
                        gtfs_route_short_name: state.selectedVehicle.gtfs_route_short_name || state.selectedVehicle.route_short_name
                    }
                } as VehicleFeature
            ]
        };
    }, [state.selectedVehicle]);

    const stopsData = useMemo(() => {
        if (!stops) return null;
        return {
            type: 'FeatureCollection',
            features: stops.features.filter(f => !f.properties.is_centroid)
        } as StopCollection;
    }, [stops]);

    const labelData = useMapCentroids(stops || null);

    // 4. Map Behavior & Event Handlers

    // Auto-following logic: Smooth map movement
    useEffect(() => {
        if (!state.isFollowing || !state.selectedVehicle?._geometry || !mapRef.current) return;

        const [lng, lat] = state.selectedVehicle._geometry;
        const isMobile = typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false;

        mapRef.current.easeTo({
            center: [lng, lat],
            duration: 1000,
            essential: true,
            padding: isMobile
                ? { bottom: window.innerHeight / MOBILE_BOTTOM_SHEET_RATIO, top: 0, left: 0, right: 0 }
                : { bottom: 0, top: 0, left: SIDEBAR_WIDTH, right: 0 }
        });
    }, [state.selectedVehicle?._geometry, state.isFollowing, mapRef]);

    const getRoundedBounds = useCallback((map: Map) => {
        const b = map.getBounds();
        const zoom = map.getZoom();
        const round = (num: number) => Math.round(num * 1000) / 1000;
        return b && zoom >= MAP_MIN_ZOOM_FOR_DATA
            ? `${round(b.getSouth())},${round(b.getWest())},${round(b.getNorth())},${round(b.getEast())}`
            : null;
    }, []);

    const onMove = useCallback((evt: { viewState: { zoom: number }; target: Map; originalEvent?: unknown }) => {
        if (state.isFollowing) return;

        const { zoom } = evt.viewState;
        if (!evt.originalEvent) return;

        const currentBounds = getRoundedBounds(evt.target);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setDebouncedBounds(currentBounds);
            setBounds(currentBounds);
        }, MAP_BOUNDS_DEBOUNCE);

        if (zoom < MAP_MIN_ZOOM_FOR_DATA && state.bounds !== null) {
            setBounds(null);
        }
    }, [state.bounds, state.isFollowing, getRoundedBounds, setBounds, setDebouncedBounds]);

    const onMoveEnd = useCallback((evt: { viewState: { latitude: number; longitude: number; zoom: number }; target: Map; originalEvent?: unknown }) => {
        if (state.isFollowing) return;

        const { latitude, longitude, zoom } = evt.viewState;
        const currentBounds = getRoundedBounds(evt.target);

        const url = new URL(window.location.href);
        url.searchParams.set('lat', latitude.toFixed(5));
        url.searchParams.set('lng', longitude.toFixed(5));
        url.searchParams.set('z', zoom.toFixed(2));
        window.history.replaceState({}, '', url.toString());

        if (evt.originalEvent) {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            setBounds(currentBounds);
            setDebouncedBounds(currentBounds);
        }
    }, [state.isFollowing, getRoundedBounds, setBounds, setDebouncedBounds]);

    const onDragStart = useCallback(() => {
        if (state.isFollowing) {
            setIsFollowing(false);
        }
    }, [state.isFollowing, setIsFollowing]);

    const handleDepartureClick = useCallback(async (tripId: string, vehicleId?: string, initialData?: Partial<Departure>) => {
        const activeVehId = vehicleId || `trip-${tripId}`;

        setSelectedVehicle({
            vehicle_id: activeVehId,
            gtfs_trip_id: tripId,
            trip_id: tripId,
            gtfs_route_short_name: initialData?.line,
            route_type: initialData?.type,
            gtfs_trip_headsign: initialData?.headsign,
            delay: initialData?.delay || 0,
            state_position: 'on_track',
            _geometry: [0, 0],
            bearing: null
        });

        try {
            const res = await fetch(`/api/vehicle-detail?tripId=${encodeURIComponent(tripId)}&vehicleId=${encodeURIComponent(activeVehId)}`);
            if (res.ok) {
                const data = await res.json();
                queryClient.setQueryData(['vehicle-detail', activeVehId, tripId], data);

                if (data.geometry?.coordinates) {
                    const coords = data.geometry.coordinates;
                    const { ...liteData } = data;
                    setSelectedVehicle((prev: TrackedVehicle | null) => prev ? { ...prev, _geometry: coords, ...liteData } as TrackedVehicle : null);
                    setIsFollowing(true);

                    const isMobile = typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false;
                    mapRef.current?.flyTo({
                        center: coords,
                        zoom: MAP_VEHICLE_SELECT_ZOOM,
                        duration: MAP_ANIMATION_DURATION,
                        essential: true,
                        padding: isMobile
                            ? { bottom: window.innerHeight / MOBILE_BOTTOM_SHEET_RATIO, top: 0, left: 0, right: 0 }
                            : { bottom: 0, top: 0, left: SIDEBAR_WIDTH, right: 0 }
                    });
                }
            }
        } catch (err) {
            console.error('Prefetch failed:', err);
        }
    }, [mapRef, queryClient, setSelectedVehicle, setIsFollowing]);

    const onLoad = useCallback((evt: { target: Map }) => {
        const map = evt.target;
        const layers = map.getStyle().layers;
        if (layers) {
            const firstLabelLayer = layers.find((layer) => layer.type === 'symbol' && (layer as any).layout?.['text-field']);
            if (firstLabelLayer) {
                setLabelLayerId(firstLabelLayer.id);
            }
        }
        addAllIcons(map);
        setMapLoaded(true);

        const b = map.getBounds();
        const z = map.getZoom();
        if (b && z >= MAP_MIN_ZOOM_FOR_DATA) {
            const round = (num: number) => Math.round(num * 1000) / 1000;
            const initialBounds = `${round(b.getSouth())},${round(b.getWest())},${round(b.getNorth())},${round(b.getEast())}`;
            setBounds(initialBounds);
            setDebouncedBounds(initialBounds);
        }

        performGeolocation(false);
    }, [performGeolocation, setBounds, setDebouncedBounds]);

    return useMemo(() => ({
        /** Direct reference to the MapLibre instance */
        mapRef,
        /** Current UI and Interaction state */
        state: {
            ...state,
            mapLoaded,
            selectedId,
            labelLayerId,
            userLocation
        },
        /** Functions to update state or trigger side effects */
        actions: {
            setSelectedStop,
            setSelectedVehicle,
            setIsFollowing,
            setShowVehicles,
            setIsSettingsOpen,
            setExpandedGroups,
            toggleGroup,
            setDepartureSort,
            setRouteFilter,
            setBounds,
            setDebouncedBounds,
            handleLocate,
            handleDepartureClick
        },
        /** Fetched and derived transit data for map sources */
        data: {
            displayVehicles,
            selectedVehicleFeature,
            vehicleDetail,
            loadingDetail,
            stopsData,
            labelData,
            groupedDepartures,
            stops,
            loadingDeps,
            routeShapeData,
            fetchingVehicles,
            dataUpdatedAt
        },
        /** MapLibre event handlers */
        mapEvents: {
            onMove,
            onMoveEnd,
            onLoad,
            onDragStart
        }
    }), [
        mapRef, state, mapLoaded, selectedId, labelLayerId, userLocation,
        setSelectedStop, setSelectedVehicle, setIsFollowing, setShowVehicles,
        setIsSettingsOpen, setExpandedGroups, toggleGroup, setDepartureSort,
        setRouteFilter, setBounds, setDebouncedBounds, handleLocate, handleDepartureClick,
        displayVehicles, selectedVehicleFeature, vehicleDetail, loadingDetail,
        stopsData, labelData, groupedDepartures, stops, loadingDeps,
        routeShapeData, fetchingVehicles, dataUpdatedAt,
        onMove, onMoveEnd, onLoad, onDragStart
    ]);
};
