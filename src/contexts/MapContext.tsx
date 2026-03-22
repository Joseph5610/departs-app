import React, { useState, useCallback, useRef, useMemo } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import type { Map } from 'maplibre-gl';
import { useMapReducer } from '../hooks/useMapReducer';
import { useGeolocation } from '../hooks/useGeolocation';
import { useMapSync } from '../hooks/useMapSync';
import { useMapInterface } from '../hooks/useMapInterface';
import { addAllIcons } from '../utils/mapIcons';
import type { Departure, VehicleDetail } from '../types/transit';
import { MapContext, type MapContextType } from '../hooks/useMap';
import {
    MAP_MIN_ZOOM_FOR_DATA,
    MAP_BOUNDS_DEBOUNCE
} from '../config/constants';

/**
 * Internal component to handle background sync and interface processes.
 * It is isolated from the Provider to avoid full context re-renders
 * for minor background updates.
 */
const MapEngine: React.FC = () => {
    // 1. Data Coordination (Sync state with APIs)
    useMapSync();

    // 2. User Experience (Sync Map interface with state)
    useMapInterface();

    return null;
};

export const MapProvider: React.FC<{ children: React.ReactNode; mapRef: React.RefObject<MapRef | null> }> = ({ children, mapRef }) => {
    const [mapLoaded, setMapLoaded] = useState(false);
    const [labelLayerId, setLabelLayerId] = useState<string | undefined>(undefined);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const {
        state,
        updateStop,
        updateVehicle,
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

    const { userLocation, userSpeed, isGeoPending, handleLocate, performGeolocation } = useGeolocation(mapRef, mapLoaded);

    // Map Event Handlers
    const getRoundedBounds = useCallback((map: Map) => {
        const b = map.getBounds();
        const zoom = map.getZoom();
        const round = (num: number) => { return Math.round(num * 1000) / 1000; };
        return b && zoom >= MAP_MIN_ZOOM_FOR_DATA
            ? `${round(b.getSouth())},${round(b.getWest())},${round(b.getNorth())},${round(b.getEast())}`
            : null;
    }, []);

    const onMove = useCallback((evt: { viewState: { zoom: number }; target: Map; originalEvent?: unknown }) => {
        if (state.isFollowing) {
            return;
        }
        if (!evt.originalEvent) {
            return;
        }

        const { zoom } = evt.viewState;
        const currentBounds = getRoundedBounds(evt.target);

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
            setDebouncedBounds(currentBounds);
            setBounds(currentBounds);
        }, MAP_BOUNDS_DEBOUNCE);

        if (zoom < MAP_MIN_ZOOM_FOR_DATA && state.bounds !== null) {
            setBounds(null);
        }
    }, [state.bounds, state.isFollowing, getRoundedBounds, setBounds, setDebouncedBounds]);

    const onMoveEnd = useCallback((evt: { viewState: { latitude: number; longitude: number; zoom: number }; target: Map; originalEvent?: unknown }) => {
        if (state.isFollowing) {
            return;
        }

        const { latitude, longitude, zoom } = evt.viewState;
        const currentBounds = getRoundedBounds(evt.target);

        const url = new URL(window.location.href);
        url.searchParams.set('lat', latitude.toFixed(5));
        url.searchParams.set('lng', longitude.toFixed(5));
        url.searchParams.set('z', zoom.toFixed(2));
        window.history.replaceState({}, '', url.toString());

        if (evt.originalEvent) {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
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
            const firstLabelLayer = layers.find((layer) => {
                return layer.type === 'symbol' &&
                (layer as maplibregl.SymbolLayerSpecification).layout?.['text-field'];
            });
            if (firstLabelLayer) {
                setLabelLayerId(firstLabelLayer.id);
            }
        }
        addAllIcons(map);
        setMapLoaded(true);

        const b = map.getBounds();
        const z = map.getZoom();
        if (b && z >= MAP_MIN_ZOOM_FOR_DATA) {
            const round = (num: number) => { return Math.round(num * 1000) / 1000; };
            const initialBounds = `${round(b.getSouth())},${round(b.getWest())},${round(b.getNorth())},${round(b.getEast())}`;
            setBounds(initialBounds);
            setDebouncedBounds(initialBounds);
        }

    }, [setBounds, setDebouncedBounds]);

    const handleDepartureClick = useCallback(async (tripId: string, vehicleId?: string, initialData?: Partial<Departure>) => {
        selectVehicle({
            vehicle_id: vehicleId || null,
            gtfs_trip_id: tripId,
            route_short_name: initialData?.line,
            route_type: initialData?.type,
            trip_headsign: initialData?.headsign,
            delay: initialData?.delay ?? 0,
            bearing: null
        } as VehicleDetail, true); // keep stop
    }, [selectVehicle]);

    const value = useMemo(() => {
        return {
            mapRef,
            state: {
                ...state,
                mapLoaded,
                labelLayerId,
                userLocation,
                userSpeed,
                isGeoPending
            },
            actions: {
                updateStop,
                updateVehicle,
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
        };
    }, [
        mapRef, state, mapLoaded, labelLayerId, userLocation, userSpeed, isGeoPending,
        updateStop, updateVehicle, selectStop, selectVehicle, clearSelection,
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
