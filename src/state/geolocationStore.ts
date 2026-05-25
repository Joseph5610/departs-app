import { create } from 'zustand';

export interface GeolocationState {
    userLocation: [number, number] | null;
    userSpeed: number | null;
    isGeoPending: boolean;
}

export interface GeolocationActions {
    setUserLocation: (location: [number, number] | null) => void;
    setUserSpeed: (speed: number | null) => void;
    setIsGeoPending: (pending: boolean) => void;
}

export interface GeolocationStore extends GeolocationState {
    actions: GeolocationActions;
}

export const useGeolocationStore = create<GeolocationStore>((set) => ({
    // State
    userLocation: null,
    userSpeed: null,
    isGeoPending: false,

    // Actions
    actions: {
        setUserLocation: (userLocation) => set({ userLocation }),
        setUserSpeed: (userSpeed) => set({ userSpeed }),
        setIsGeoPending: (isGeoPending) => set({ isGeoPending }),
    },
}));
