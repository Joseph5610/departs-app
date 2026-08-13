import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface GeolocationState {
    userLocation: [number, number] | null;
    userSpeed: number | null;
    isGeoPending: boolean;
    watchId: number | null;
    lastUpdatedAt: number;
    lastLocation: { lat: number; lng: number } | null;
}

export interface GeolocationActions {
    setUserLocation: (location: [number, number] | null) => void;
    setUserSpeed: (speed: number | null) => void;
    setIsGeoPending: (pending: boolean) => void;
    setWatchId: (id: number | null) => void;
    setLastUpdatedAt: (time: number) => void;
    setLastLocation: (location: { lat: number; lng: number } | null) => void;
}

export interface GeolocationStore extends GeolocationState {
    actions: GeolocationActions;
}

export const useGeolocationStore = create<GeolocationStore>()(
    persist(
        (set) => ({
            // State
            userLocation: null,
            userSpeed: null,
            isGeoPending: false,
            watchId: null,
            lastUpdatedAt: 0,
            lastLocation: null,

            // Actions
            actions: {
                setUserLocation: (userLocation) => set({ userLocation }),
                setUserSpeed: (userSpeed) => set({ userSpeed }),
                setIsGeoPending: (isGeoPending) => set({ isGeoPending }),
                setWatchId: (watchId) => set({ watchId }),
                setLastUpdatedAt: (lastUpdatedAt) => set({ lastUpdatedAt }),
                setLastLocation: (lastLocation) => set({ lastLocation }),
            },
        }),
        {
            name: 'departs-last-location',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                lastLocation: state.lastLocation,
            }),
        }
    )
);
