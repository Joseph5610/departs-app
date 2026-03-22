import React, { useState, useCallback, useRef, useMemo } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import type { Map } from 'maplibre-gl';
import { useMapReducer } from '../hooks/useMapReducer';
import { useGeolocation } from '../hooks/useGeolocation';
import { useMapUrlSync } from '../hooks/useMapUrlSync';
import { useMapAnimation } from '../hooks/useMapAnimation';
import { useMapCameraFollow } from '../hooks/useMapCameraFollow';
import { useMapVehicleSync } from '../hooks/useMapVehicleSync';
import { useVehicles } from '../hooks/useVehicles';
import { useVehicleDetail } from '../hooks/useVehicleDetail';
import { useStops } from '../hooks/useStops';
import { useMapStopEnrichment } from '../hooks/useMapStopEnrichment';
import { addAllIcons } from '../utils/mapIcons';
import type { Departure } from '../types/transit';
import { MapContext, type MapContextType, useMap } from '../hooks/useMap';
import {
    MAP_MIN_ZOOM_FOR_DATA,
    MAP_BOUNDS_DEBOUNCE
} from '../config/constants';

/**
 * Internal component to handle background sync processes.
 * It consumes the context it's placed in.
 */
const MapEngine: React.FC = () => {
    const { state, actions, mapRef } = useMap();
    const { selectedStop, selectedVehicle, isFollowing, selectedId } = state;
    const { setSelectedStop, setSelectedVehicle, selectVehicle } = actions;

    // Data needed for sync hooks
    const { vehicles: rawVehicles } = useVehicles();
    const { data: vehicleDetail } = useVehicleDetail();
    const { _raw_data: stopsRawData } = useStops();

    // Sync Background Logic
    useMapUrlSync(selectedStop, setSelectedStop, selectedVehicle, selectVehicle);
    useMapStopEnrichment(selectedStop, setSelectedStop, stopsRawData || null);
    useMapAnimation(mapRef, selectedVehicle, isFollowing);
    useMapCameraFollow(mapRef, selectedVehicle, isFollowing, selectedStop);
    useMapVehicleSync(mapRef, selectedId, selectedVehicle, setSelectedVehicle, isFollowing, rawVehicles, vehicleDetail);

    return null;
};

export const MapProvider: React.FC<{ children: React.ReactNode; mapRef: React.RefObject<MapRef | null> }> = ({ children, mapRef }) => {
    const [mapLoaded, setMapLoaded] = useState(false);
    const [labelLayerId, setLabelLayerId] = useState<string | undefined>(undefined);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const {
        state,
        setSelectedStop,
        setSelectedVehicle,
        selectStop,
        selectVehicle,
        clearSelection,
        setIsFollowing,
        setShowVehicles,
        setShowStops,
        setIsSettingsOpen,
        setExpandedGroups,
        toggleGroup,
        setDepartureSort,
        setRouteFilter,
        setRouteTypeFilter,
        setBounds,
        setDebouncedBounds,
        toggleFavorite,
        addToHistory,
        clearHistory
    } = useMapReducer();

    const { userLocation, userSpeed, isGeoPending, handleLocate, performGeolocation } = useGeolocation(mapRef);

    // Map Event Handlers
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
        if (!evt.originalEvent) return;

        const { zoom } = evt.viewState;
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

    const onLoad = useCallback((evt: { target: Map }) => {
        const map = evt.target;
        const style = map.getStyle();
        const layers = style?.layers;
        if (layers) {
            const firstLabelLayer = layers.find((layer) =>
                layer.type === 'symbol' &&
                (layer as maplibregl.SymbolLayerSpecification).layout?.['text-field']
            );
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

        performGeolocation();
    }, [performGeolocation, setBounds, setDebouncedBounds]);

    const handleDepartureClick = useCallback(async (tripId: string, vehicleId?: string, initialData?: Partial<Departure>) => {
        selectVehicle({
            vehicle_id: vehicleId || null,
            gtfs_trip_id: tripId,
            route_short_name: initialData?.line,
            route_type: initialData?.type,
            trip_headsign: initialData?.headsign,
            delay: initialData?.delay ?? 0,
            origin_timestamp: initialData?.scheduled,
            state_position: 'on_track',
            geometry: {
                type: 'Point',
                coordinates: [0, 0]
            },
            bearing: null
        }, true); // keep stop
    }, [selectVehicle]);

    const value = useMemo(() => ({
        mapRef,
        state: {
            ...state,
            mapLoaded,
            labelLayerId,
            userLocation,
            userSpeed,
            isGeoPending,
            selectedId: state.selectedVehicle?.vehicle_id || null
        },
        actions: {
            setSelectedStop,
            setSelectedVehicle,
            selectStop,
            selectVehicle,
            clearSelection,
            setIsFollowing,
            setShowVehicles,
            setShowStops,
            setIsSettingsOpen,
            setExpandedGroups,
            toggleGroup,
            setDepartureSort,
            setRouteFilter,
            setRouteTypeFilter,
            setBounds,
            setDebouncedBounds,
            toggleFavorite,
            addToHistory,
            clearHistory,
            handleLocate,
            handleDepartureClick,
            performGeolocation,
            setMapLoaded,
            setLabelLayerId
        },
        mapEvents: {
            onMove,
            onMoveEnd,
            onLoad,
            onDragStart
        }
    }), [
        mapRef, state, mapLoaded, labelLayerId, userLocation, userSpeed, isGeoPending,
        setSelectedStop, setSelectedVehicle, selectStop, selectVehicle, clearSelection,
        setIsFollowing, setShowVehicles, setShowStops,
        setIsSettingsOpen, setExpandedGroups, toggleGroup, setDepartureSort,
        setRouteFilter, setRouteTypeFilter, setBounds, setDebouncedBounds,
        toggleFavorite, addToHistory, clearHistory,
        handleLocate, handleDepartureClick, performGeolocation,
        setMapLoaded, setLabelLayerId,
        onMove, onMoveEnd, onLoad, onDragStart
    ]);

    return (
        <MapContext.Provider value={value as MapContextType}>
            <MapEngine />
            {children}
        </MapContext.Provider>
    );
};
