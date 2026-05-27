import { create } from 'zustand';

export interface ViewportState {
    bounds: string | null;
    debouncedBounds: string | null;
    routeFilter: string[] | null;
    selectedPlaceId: string | null;
}

export interface ViewportActions {
    setBounds: (bounds: string | null) => void;
    setDebouncedBounds: (bounds: string | null) => void;
    setRouteFilter: (filter: string[] | null) => void;
    setSelectedPlaceId: (id: string | null) => void;
}

export interface ViewportStore extends ViewportState {
    actions: ViewportActions;
}

export const useViewportStore = create<ViewportStore>((set) => ({
    // State
    bounds: null,
    debouncedBounds: null,
    routeFilter: null,
    selectedPlaceId: null,

    // Actions
    actions: {
        setBounds: (bounds) => set({ bounds }),
        setDebouncedBounds: (debouncedBounds) => set({ debouncedBounds }),
        setRouteFilter: (routeFilter) => set({ routeFilter }),
        setSelectedPlaceId: (selectedPlaceId) => set({ selectedPlaceId }),
    },
}));
