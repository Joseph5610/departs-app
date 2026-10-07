import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { LOCATION_PRIVACY } from '@/config/constants';

/** Why the map should move to the next fresh fix: a locate tap, or a silent automatic focus (launch, welcome). */
export type FocusRequest = 'locate' | 'auto';

export interface GeolocationState {
    userLocation: [number, number] | null;
    focusRequest: FocusRequest | null;
    focusRequestedAt: number;
    lastUpdatedAt: number;
    lastLocation: { lat: number; lng: number } | null;
}

interface GeolocationActions {
    /** A new position fix: the live location, its time, and the coarse copy kept on the device. */
    applyFix: (location: [number, number], at: number) => void;
    requestFocus: (request: FocusRequest | null) => void;
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
            userLocation: null,
            focusRequest: null,
            focusRequestedAt: 0,
            lastUpdatedAt: 0,
            lastLocation: null,

            actions: {
                applyFix: ([lng, lat], at) => set({ userLocation: [lng, lat], lastUpdatedAt: at, lastLocation: coarsenLocation({ lat, lng }) }),
                requestFocus: (focusRequest) => set({ focusRequest, focusRequestedAt: Date.now() }),
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
