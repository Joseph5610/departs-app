import { create } from 'zustand';

export interface GeolocationState {
    userLocation: [number, number] | null;
    userSpeed: number | null;
    isGeoPending: boolean;
    watchId: number | null;
    lastUpdatedAt: number;
}

export interface GeolocationActions {
    setUserLocation: (location: [number, number] | null) => void;
    setUserSpeed: (speed: number | null) => void;
    setIsGeoPending: (pending: boolean) => void;
    setWatchId: (id: number | null) => void;
    setLastUpdatedAt: (time: number) => void;
}

export interface GeolocationStore extends GeolocationState {
    actions: GeolocationActions;
}

export const useGeolocationStore = create<GeolocationStore>((set) => ({
    // State
    userLocation: null,
    userSpeed: null,
    isGeoPending: false,
    watchId: null,
    lastUpdatedAt: 0,

    // Actions
    actions: {
        setUserLocation: (userLocation) => set({ userLocation }),
        setUserSpeed: (userSpeed) => set({ userSpeed }),
        setIsGeoPending: (isGeoPending) => set({ isGeoPending }),
        setWatchId: (watchId) => set({ watchId }),
        setLastUpdatedAt: (lastUpdatedAt) => set({ lastUpdatedAt }),
    },
}));
