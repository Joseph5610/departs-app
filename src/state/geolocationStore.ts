import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { LOCATION_PRIVACY } from '../config/constants';

export interface GeolocationState {
    userLocation: [number, number] | null;
    userSpeed: number | null;
    isGeoPending: boolean;
    watchId: number | null;
    lastUpdatedAt: number;
    lastLocation: { lat: number; lng: number } | null;
}

interface GeolocationActions {
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

type SavedLocation = GeolocationState['lastLocation'];

const LOCATION_FACTOR = 10 ** LOCATION_PRIVACY.SAVED_LOCATION_DECIMALS;

/** Coarsens a position before it is stored on the device; it only serves to reopen the map nearby. */
const coarsenLocation = (location: SavedLocation): SavedLocation => {
    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') return null;
    return {
        lat: Math.round(location.lat * LOCATION_FACTOR) / LOCATION_FACTOR,
        lng: Math.round(location.lng * LOCATION_FACTOR) / LOCATION_FACTOR,
    };
};

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
                setLastLocation: (lastLocation) => set({ lastLocation: coarsenLocation(lastLocation) }),
            },
        }),
        {
            name: 'departs-last-location',
            storage: createJSONStorage(() => localStorage),
            // Version 0 stored the full GPS precision.
            version: 1,
            migrate: (persisted) => ({
                lastLocation: coarsenLocation((persisted as Partial<GeolocationState> | null)?.lastLocation ?? null),
            }),
            partialize: (state) => ({
                lastLocation: state.lastLocation,
            }),
        }
    )
);
