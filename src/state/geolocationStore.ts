import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { LOCATION_PRIVACY } from '@/config/constants';

/**
 * Why the map should move to the next fresh fix: a locate tap (anywhere), the app opening or coming back
 * (onto the user, switching city), or the welcome screen (only within the city picked there).
 */
export type FocusRequest = 'locate' | 'launch' | 'welcome';

export interface GeolocationState {
    userLocation: [number, number] | null;
    /** Accuracy of `userLocation` in metres. */
    accuracyM: number;
    focusRequest: FocusRequest | null;
    focusRequestedAt: number;
    lastUpdatedAt: number;
    lastLocation: { lat: number; lng: number } | null;
    /** When `lastLocation` was taken. */
    lastLocationAt: number;
    /** The user has shared their location before, so the app may look for it at launch without a tap. */
    locationOptIn: boolean;
}

interface GeolocationActions {
    /** A new position fix: the live location, its time, and the coarse copy kept on the device. */
    applyFix: (location: [number, number], accuracyM: number, at: number) => void;
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
            accuracyM: Infinity,
            focusRequest: null,
            focusRequestedAt: 0,
            lastUpdatedAt: 0,
            lastLocation: null,
            lastLocationAt: 0,
            locationOptIn: false,

            actions: {
                applyFix: ([lng, lat], accuracyM, at) => set({
                    userLocation: [lng, lat], accuracyM, lastUpdatedAt: at,
                    lastLocation: coarsenLocation({ lat, lng }), lastLocationAt: at, locationOptIn: true,
                }),
                requestFocus: (focusRequest) => set({ focusRequest, focusRequestedAt: Date.now() }),
            },
        }),
        {
            name: 'departs-last-location',
            storage: createJSONStorage(() => localStorage),
            // Version 0 stored the full GPS precision; version 1 had no time, so its position counts as stale.
            version: 2,
            migrate: (persisted) => {
                const old = persisted as Partial<GeolocationState> | null;
                return {
                    lastLocation: coarsenLocation(old?.lastLocation ?? null),
                    lastLocationAt: typeof old?.lastLocationAt === 'number' ? old.lastLocationAt : 0,
                    locationOptIn: old?.lastLocation != null,
                };
            },
            partialize: (state) => ({
                lastLocation: state.lastLocation,
                lastLocationAt: state.lastLocationAt,
                locationOptIn: state.locationOptIn,
            }),
        }
    )
);
