import { createContext, useContext } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import type { Map } from 'maplibre-gl';

import { useSelectionStore } from './selectionStore';
import type { SelectionStore } from './selectionStore';
import { usePreferencesStore } from './preferencesStore';
import type { PreferencesStore } from './preferencesStore';
import { useViewportStore } from './viewportStore';
import type { ViewportStore } from './viewportStore';

// --- CONTEXT DEFINITIONS ---

export type SelectionContextType = { state: Omit<SelectionStore, 'actions'>; actions: SelectionStore['actions'] };
export const SelectionContext = createContext<SelectionContextType | null>(null);

export type PreferencesContextType = { state: Omit<PreferencesStore, 'actions'>; actions: PreferencesStore['actions'] };
export const PreferencesContext = createContext<PreferencesContextType | null>(null);

export type ViewportContextType = { state: Omit<ViewportStore, 'actions'>; actions: ViewportStore['actions'] } & {
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
    const { actions, ...state } = useSelectionStore();
    return { state, actions } as unknown as SelectionContextType;
};

export const usePreferences = () => {
    const { actions, ...state } = usePreferencesStore();
    return { state, actions } as unknown as PreferencesContextType;
};

export const useViewport = () => {
    const { actions: vpActions, ...vpState } = useViewportStore();
    const ctx = useContext(ViewportContext);

    return {
        ...ctx,
        state: vpState,
        actions: {
            ...vpActions,
            ...ctx?.actions
        }
    } as unknown as ViewportContextType;
};
