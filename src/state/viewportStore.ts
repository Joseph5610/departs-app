import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { LOCATION_PRIVACY } from '@/config/constants';
import type { Camera } from '@/domain/cities';

interface ViewportState {
    bounds: string | null;
    debouncedBounds: string | null;
    routeFilter: string[] | null;
    selectedPlaceId: string | null;
    /** Where the map was last left, coarsened, to reopen there; kept on the device only. */
    savedCamera: Camera | null;
    savedCameraAt: number;
    /** When the user last moved the map themselves; a later automatic move must not undo it. */
    userMovedAt: number;
}

interface ViewportActions {
    setBounds: (bounds: string | null) => void;
    setDebouncedBounds: (bounds: string | null) => void;
    setRouteFilter: (filter: string[] | null) => void;
    setSelectedPlaceId: (id: string | null) => void;
    saveCamera: (camera: Camera, at: number) => void;
    markUserMoved: (at: number) => void;
}

export interface ViewportStore extends ViewportState {
    actions: ViewportActions;
}

const CAMERA_FACTOR = 10 ** LOCATION_PRIVACY.SAVED_LOCATION_DECIMALS;
const coarsen = (value: number) => Math.round(value * CAMERA_FACTOR) / CAMERA_FACTOR;

export const useViewportStore = create<ViewportStore>()(
    persist(
        (set) => ({
            bounds: null,
            debouncedBounds: null,
            routeFilter: null,
            selectedPlaceId: null,
            savedCamera: null,
            savedCameraAt: 0,
            userMovedAt: 0,

            actions: {
                setBounds: (bounds) => set({ bounds }),
                setDebouncedBounds: (debouncedBounds) => set({ debouncedBounds }),
                setRouteFilter: (routeFilter) => set({ routeFilter }),
                setSelectedPlaceId: (selectedPlaceId) => set({ selectedPlaceId }),
                saveCamera: ({ lat, lng, zoom }, at) => set({ savedCamera: { lat: coarsen(lat), lng: coarsen(lng), zoom: Math.round(zoom * 10) / 10 }, savedCameraAt: at }),
                markUserMoved: (userMovedAt) => set({ userMovedAt }),
            },
        }),
        {
            name: 'departs-last-view',
            storage: createJSONStorage(() => localStorage),
            version: 1,
            partialize: (state) => ({ savedCamera: state.savedCamera, savedCameraAt: state.savedCameraAt }),
            // A damaged entry is dropped, not trusted: the map would open at NaN.
            merge: (persisted, current) => {
                const saved = persisted as Partial<ViewportState> | null;
                const camera = saved?.savedCamera;
                const isValid = !!camera && [camera.lat, camera.lng, camera.zoom].every(Number.isFinite) && Number.isFinite(saved?.savedCameraAt);
                return isValid ? { ...current, savedCamera: camera, savedCameraAt: saved!.savedCameraAt! } : current;
            },
        }
    )
);
