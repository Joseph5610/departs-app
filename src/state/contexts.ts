import { createContext, useContext } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { MapRef } from 'react-map-gl/maplibre';
import type { Map } from 'maplibre-gl';

import { useSelectionStore } from './selectionStore';
import type { SelectionStore } from './selectionStore';
import { usePreferencesStore } from './preferencesStore';
import type { PreferencesStore } from './preferencesStore';
import { useViewportStore } from './viewportStore';
import type { ViewportStore } from './viewportStore';
import { useMapMetadataStore } from './mapMetadataStore';
import { useGeolocationStore } from './geolocationStore';

// --- CONTEXT DEFINITIONS ---

export type SelectionContextType = { state: Omit<SelectionStore, 'actions'>; actions: SelectionStore['actions'] };
export type PreferencesContextType = { state: Omit<PreferencesStore, 'actions'>; actions: PreferencesStore['actions'] };

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
    const { actions, ...state } = useSelectionStore(
        useShallow((s) => ({
            selectedStopId: s.selectedStopId,
            selectedTripId: s.selectedTripId,
            selectedVehicleId: s.selectedVehicleId,
            isFollowing: s.isFollowing,
            selectedLine: s.selectedLine,
            selectedId: s.selectedId,
            actions: s.actions,
        }))
    );
    return { state, actions } as SelectionContextType;
};

export const usePreferences = () => {
    const { actions, ...state } = usePreferencesStore(
        useShallow((s) => ({
            showVehicles: s.showVehicles,
            showStops: s.showStops,
            showStopLabels: s.showStopLabels,
            stopTypeFilter: s.stopTypeFilter,
            isSettingsOpen: s.isSettingsOpen,
            isAlertsOpen: s.isAlertsOpen,
            departureSort: s.departureSort,
            routeTypeFilter: s.routeTypeFilter,
            favoriteStops: s.favoriteStops,
            searchHistory: s.searchHistory,
            mapBaseStyle: s.mapBaseStyle,
            actions: s.actions,
        }))
    );
    return { state, actions } as PreferencesContextType;
};

export const useViewport = () => {
    const { actions: vpActions, ...vpState } = useViewportStore(
        useShallow((s) => ({
            bounds: s.bounds,
            debouncedBounds: s.debouncedBounds,
            routeFilter: s.routeFilter,
            selectedPlace: s.selectedPlace,
            actions: s.actions,
        }))
    );
    const { mapLoaded, labelLayerId } = useMapMetadataStore();
    const { userLocation, userSpeed, isGeoPending } = useGeolocationStore();

    const ctx = useContext(ViewportContext);

    if (!ctx) throw new Error('useViewport must be within MapStateProvider');

    return {
        ...ctx,
        state: vpState,
        mapLoaded,
        labelLayerId,
        userLocation,
        userSpeed,
        isGeoPending,
        actions: {
            ...vpActions,
            ...ctx.actions
        }
    } as ViewportContextType;
};
