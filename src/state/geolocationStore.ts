import React from 'react';
import { create } from 'zustand';
import { toast } from 'sonner';
import i18n from '../i18n/config';
import { STORAGE_KEYS, MAP_VEHICLE_SELECT_ZOOM, MAP_FLY_DURATION } from '../config/constants';
import { useMapMetadataStore } from './mapMetadataStore';

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
    handleLocate: (e?: React.MouseEvent | React.TouchEvent) => void;
    performGeolocation: () => void;
}

export interface GeolocationStore extends GeolocationState {
    actions: GeolocationActions;
}

export const useGeolocationStore = create<GeolocationStore>((set, get) => ({
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

        performGeolocation: () => {
            const { watchId, actions } = get();
            if (typeof navigator === 'undefined' || !navigator.geolocation || watchId !== null) return;

            const id = navigator.geolocation.watchPosition(
                (pos) => {
                    const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
                    actions.setUserLocation(coords);
                    actions.setUserSpeed(pos.coords.speed);
                    actions.setLastUpdatedAt(Date.now());
                    actions.setIsGeoPending(false);
                    localStorage.setItem(STORAGE_KEYS.LAST_LOCATION, JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }));
                },
                (err) => {
                    actions.setIsGeoPending(false);
                    if (err.code === err.PERMISSION_DENIED) {
                        const currentWatchId = get().watchId;
                        if (currentWatchId !== null) {
                            navigator.geolocation.clearWatch(currentWatchId);
                            actions.setWatchId(null);
                        }
                    }
                },
                {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 10000
                }
            );
            actions.setWatchId(id);
        },

        handleLocate: (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            const { isGeoPending, userLocation, lastUpdatedAt, actions } = get();
            if (isGeoPending) return;

            const map = useMapMetadataStore.getState().mapRef.current?.getMap();
            const now = Date.now();
            const isFreshEnough = now - lastUpdatedAt < 10000;

            if (userLocation && isFreshEnough) {
                if (map) {
                    map.flyTo({ center: userLocation, zoom: MAP_VEHICLE_SELECT_ZOOM, duration: MAP_FLY_DURATION });
                }
                if (get().watchId === null) actions.performGeolocation();
                return;
            }

            if (typeof navigator === 'undefined' || !navigator.geolocation) {
                toast.error(i18n.t('toasts.geoNotSupported'));
                const saved = localStorage.getItem(STORAGE_KEYS.LAST_LOCATION);
                if (saved && map) {
                    try {
                        const { lat, lng } = JSON.parse(saved);
                        map.flyTo({ center: [lng, lat], zoom: MAP_VEHICLE_SELECT_ZOOM, duration: MAP_FLY_DURATION });
                    } catch { /* ignore */ }
                }
                return;
            }

            actions.setIsGeoPending(true);

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
                    actions.setUserLocation(coords);
                    actions.setUserSpeed(pos.coords.speed);
                    actions.setLastUpdatedAt(Date.now());
                    actions.setIsGeoPending(false);
                    if (map) {
                        map.flyTo({ center: coords, zoom: MAP_VEHICLE_SELECT_ZOOM, duration: MAP_FLY_DURATION });
                    }
                },
                () => {
                    actions.setIsGeoPending(false);
                    toast.error(i18n.t('toasts.geoError'));
                    const saved = localStorage.getItem(STORAGE_KEYS.LAST_LOCATION);
                    if (saved && map) {
                        try {
                            const { lat, lng } = JSON.parse(saved);
                            map.flyTo({ center: [lng, lat], zoom: MAP_VEHICLE_SELECT_ZOOM, duration: MAP_FLY_DURATION });
                        } catch { /* ignore */ }
                    }
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 5000
                }
            );

            if (get().watchId === null) actions.performGeolocation();
        },
    },
}));
