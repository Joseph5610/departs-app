import { create } from 'zustand';
import type { GeocodingResult } from '../hooks/data/useGeocoding';

export interface ViewportState {
    bounds: string | null;
    debouncedBounds: string | null;
    routeFilter: string[] | null;
    selectedPlace: GeocodingResult | null;
}

export interface ViewportActions {
    setBounds: (bounds: string | null) => void;
    setDebouncedBounds: (bounds: string | null) => void;
    setRouteFilter: (filter: string[] | null) => void;
    setSelectedPlace: (place: GeocodingResult | null) => void;
}

export interface ViewportStore extends ViewportState {
    actions: ViewportActions;
}

export const useViewportStore = create<ViewportStore>((set) => ({
    // State
    bounds: null,
    debouncedBounds: null,
    routeFilter: null,
    selectedPlace: null,

    // Actions
    actions: {
        setBounds: (bounds) => set({ bounds }),
        setDebouncedBounds: (debouncedBounds) => set({ debouncedBounds }),
        setRouteFilter: (routeFilter) => set({ routeFilter }),
        setSelectedPlace: (selectedPlace) => set({ selectedPlace }),
    },
}));
