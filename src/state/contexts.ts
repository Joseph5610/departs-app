import { createContext, useContext } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import type { Map } from 'maplibre-gl';

import { useSelectionReducer } from './useSelectionReducer';
import { usePreferencesReducer } from './usePreferencesReducer';
import { useViewportReducer } from './useViewportReducer';

// --- CONTEXT DEFINITIONS ---

export type SelectionContextType = ReturnType<typeof useSelectionReducer>;
export const SelectionContext = createContext<SelectionContextType | null>(null);

export type PreferencesContextType = ReturnType<typeof usePreferencesReducer>;
export const PreferencesContext = createContext<PreferencesContextType | null>(null);

export type ViewportContextType = ReturnType<typeof useViewportReducer> & {
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
        handleDepartureClick: (tripId: string, vehicleId?: string) => Promise<void>;
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
