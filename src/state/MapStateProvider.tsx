import React, { useState, useCallback, useRef, useMemo, createContext, useContext } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import type { Map } from 'maplibre-gl';

import { useSelectionReducer } from './useSelectionReducer';
import { usePreferencesReducer } from './usePreferencesReducer';
import { useViewportReducer } from './useViewportReducer';

import { useGeolocation } from '../hooks/features/useGeolocation';
import { useMapInterface } from '../hooks/useMapInterface';
import { addAllIcons } from '../utils/mapIcons';
import {
    MAP_MIN_ZOOM_FOR_DATA,
    MAP_BOUNDS_DEBOUNCE,
    MAP_FLY_DURATION,
    MAP_VEHICLE_SELECT_ZOOM
} from '../config/constants';
import type { Departure } from '../types/transit';

// --- CONTEXT DEFINITIONS ---

type SelectionContextType = ReturnType<typeof useSelectionReducer>;
export const SelectionContext = createContext<SelectionContextType | null>(null);

type PreferencesContextType = ReturnType<typeof usePreferencesReducer>;
export const PreferencesContext = createContext<PreferencesContextType | null>(null);

type ViewportContextType = ReturnType<typeof useViewportReducer> & {
    mapRef: React.RefObject<MapRef | null>;
    mapLoaded: boolean;
    labelLayerId: string | undefined;
    
    // Geolocation
    userLocation: [number, number] | null;
    userSpeed: number | null;
    isGeoPending: boolean;
    
    actions: {
        handleLocate: (e?: React.MouseEvent | React.TouchEvent) => void;
        performGeolocation: () => void;
        setMapLoaded: (loaded: boolean) => void;
        setLabelLayerId: (id: string | undefined) => void;
        handleDepartureClick: (tripId: string, vehicleId?: string, initialData?: Partial<Departure>) => Promise<void>;
    };
    
    mapEvents: {
        onMove: (evt: { viewState: { zoom: number }; target: Map; originalEvent?: unknown }) => void;
        onMoveEnd: (evt: { viewState: { latitude: number; longitude: number; zoom: number }; target: Map; originalEvent?: unknown }) => void;
        onLoad: (evt: { target: Map }) => void;
        onDragStart: () => void;
    };
};
export const ViewportContext = createContext<ViewportContextType | null>(null);

// --- CONSUMER HOOKS ---

export const useSelection = () => {
    const ctx = useContext(SelectionContext);
    if (!ctx) throw new Error('useSelection must be within MapStateProvider');
    return ctx;
};

export const usePreferences = () => {
    const ctx = useContext(PreferencesContext);
    if (!ctx) throw new Error('usePreferences must be within MapStateProvider');
    return ctx;
};

export const useViewport = () => {
    const ctx = useContext(ViewportContext);
    if (!ctx) throw new Error('useViewport must be within MapStateProvider');
    return ctx;
};

// --- ENGINE & PROVIDER ---

const MapEngine: React.FC = () => {
    useMapInterface();
    return null;
};

export const MapStateProvider: React.FC<{ children: React.ReactNode; mapRef: React.RefObject<MapRef | null> }> = ({ children, mapRef }) => {
    const [mapLoaded, setMapLoaded] = useState(false);
    const [labelLayerId, setLabelLayerId] = useState<string | undefined>(undefined);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const selectionContext = useSelectionReducer();
    const preferencesContext = usePreferencesReducer();
    const viewportContext = useViewportReducer();

    const { state: selState, actions: selActions } = selectionContext;
    const { state: vpState, actions: vpActions } = viewportContext;

    const flyToLocation = useCallback((location: [number, number], isJump: boolean = false) => {
        const map = mapRef.current?.getMap();
        if (!map) return;
        if (isJump) {
            map.jumpTo({ center: location, zoom: MAP_VEHICLE_SELECT_ZOOM });
        } else {
            map.flyTo({ center: location, zoom: MAP_VEHICLE_SELECT_ZOOM, duration: MAP_FLY_DURATION });
        }
    }, [mapRef]);

    const { userLocation, userSpeed, isGeoPending, handleLocate, performGeolocation } = useGeolocation(flyToLocation, mapLoaded);

    const getRoundedBounds = useCallback((map: Map) => {
        const b = map.getBounds();
        const zoom = map.getZoom();
        const round = (num: number) => Math.round(num * 1000) / 1000;
        return b && zoom >= MAP_MIN_ZOOM_FOR_DATA
            ? `${round(b.getSouth())},${round(b.getWest())},${round(b.getNorth())},${round(b.getEast())}`
            : null;
    }, []);

    const onMove = useCallback((evt: { viewState: { zoom: number }; target: Map; originalEvent?: unknown }) => {
        if (selState.isFollowing) return;
        if (!evt.originalEvent) return;

        const { zoom } = evt.viewState;
        const currentBounds = getRoundedBounds(evt.target);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            vpActions.setDebouncedBounds(currentBounds);
            vpActions.setBounds(currentBounds);
        }, MAP_BOUNDS_DEBOUNCE);

        if (zoom < MAP_MIN_ZOOM_FOR_DATA && vpState.bounds !== null) {
            vpActions.setBounds(null);
        }
    }, [vpState.bounds, selState.isFollowing, getRoundedBounds, vpActions]);

    const onMoveEnd = useCallback((evt: { viewState: { latitude: number; longitude: number; zoom: number }; target: Map; originalEvent?: unknown }) => {
        if (selState.isFollowing) return;

        const { latitude, longitude, zoom } = evt.viewState;
        const currentBounds = getRoundedBounds(evt.target);

        const url = new URL(window.location.href);
        url.searchParams.set('lat', latitude.toFixed(5));
        url.searchParams.set('lng', longitude.toFixed(5));
        url.searchParams.set('z', zoom.toFixed(2));
        window.history.replaceState({}, '', url.toString());

        if (evt.originalEvent) {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            vpActions.setBounds(currentBounds);
            vpActions.setDebouncedBounds(currentBounds);
        }
    }, [selState.isFollowing, getRoundedBounds, vpActions]);

    const onDragStart = useCallback(() => {
        if (selState.isFollowing) selActions.setIsFollowing(false);
    }, [selState.isFollowing, selActions]);

    const onLoad = useCallback((evt: { target: Map }) => {
        const map = evt.target;
        const style = map.getStyle();
        const layers = style?.layers;
        if (layers) {
            const firstLabelLayer = layers.find(layer => layer.type === 'symbol' && (layer as maplibregl.SymbolLayerSpecification).layout?.['text-field']);
            if (firstLabelLayer) setLabelLayerId(firstLabelLayer.id);
        }
        addAllIcons(map);
        setMapLoaded(true);

        const b = map.getBounds();
        const z = map.getZoom();
        if (b && z >= MAP_MIN_ZOOM_FOR_DATA) {
            const round = (num: number) => Math.round(num * 1000) / 1000;
            const initialBounds = `${round(b.getSouth())},${round(b.getWest())},${round(b.getNorth())},${round(b.getEast())}`;
            vpActions.setBounds(initialBounds);
            vpActions.setDebouncedBounds(initialBounds);
        }
    }, [vpActions]);

    const handleDepartureClick = useCallback(async (tripId: string, vehicleId?: string) => {
        selActions.selectVehicle(tripId, vehicleId || null, true);
    }, [selActions]);

    const finalViewportValue = useMemo<ViewportContextType>(() => ({
        ...viewportContext,
        mapRef,
        mapLoaded,
        labelLayerId,
        userLocation,
        userSpeed,
        isGeoPending,
        actions: {
            ...vpActions,
            handleLocate,
            performGeolocation,
            setMapLoaded,
            setLabelLayerId,
            handleDepartureClick
        },
        mapEvents: { onMove, onMoveEnd, onLoad, onDragStart }
    }), [
        viewportContext, mapRef, mapLoaded, labelLayerId, userLocation, userSpeed, isGeoPending,
        handleLocate, performGeolocation, handleDepartureClick,
        onMove, onMoveEnd, onLoad, onDragStart
    ]);

    return (
        <SelectionContext.Provider value={selectionContext}>
            <PreferencesContext.Provider value={preferencesContext}>
                <ViewportContext.Provider value={finalViewportValue}>
                    <MapEngine />
                    {children}
                </ViewportContext.Provider>
            </PreferencesContext.Provider>
        </SelectionContext.Provider>
    );
};
