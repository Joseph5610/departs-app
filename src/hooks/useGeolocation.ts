
import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from './useToast';
import type { MapRef } from 'react-map-gl/maplibre';
import { MAP_FLY_DURATION, MAP_VEHICLE_SELECT_ZOOM, STORAGE_KEYS } from '../config/constants';

/**
 * useGeolocation
 *
 * Handles user position tracking and map focus.
 * Updated to remove "searching" toast as per user request.
 */
export const useGeolocation = (mapRef: React.RefObject<MapRef | null>) => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [userSpeed, setUserSpeed] = useState<number | null>(null);
    const [isGeoPending, setIsGeoPending] = useState(false);

    const watchId = useRef<number | null>(null);
    const lastUpdatedAt = useRef<number>(0);
    const isInitialSet = useRef(false);

    // Helper to fly the map to a location
    const flyToLocation = useCallback((location: [number, number], isJump: boolean = false) => {
        const map = mapRef.current?.getMap();
        if (!map) return;

        if (isJump) {
            map.jumpTo({ center: location, zoom: MAP_VEHICLE_SELECT_ZOOM });
        } else {
            map.flyTo({
                center: location,
                zoom: MAP_VEHICLE_SELECT_ZOOM,
                duration: MAP_FLY_DURATION
            });
        }
    }, [mapRef]);

    const updateLocation = useCallback((pos: GeolocationPosition) => {
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setUserLocation(coords);
        setUserSpeed(pos.coords.speed);
        lastUpdatedAt.current = Date.now();
        localStorage.setItem(STORAGE_KEYS.LAST_LOCATION, JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }));

        // Initial map focus (only if no coordinates or specific stops/trips are in URL)
        if (!isInitialSet.current) {
            const p = new URLSearchParams(window.location.search);
            const hasExplicitLocation = p.has('lat') || p.has('lng') || p.has('stopId') || p.has('tripId');
            if (!hasExplicitLocation) {
                flyToLocation(coords, true);
            }
            isInitialSet.current = true;
        }
    }, [flyToLocation]);

    const startWatcher = useCallback(() => {
        if (typeof navigator === 'undefined' || !navigator.geolocation || watchId.current !== null) return;

        watchId.current = navigator.geolocation.watchPosition(
            (pos) => {
                updateLocation(pos);
                setIsGeoPending(false);
            },
            (err) => {
                setIsGeoPending(false);

                // Only clear watch on permission denied. For other errors, keep it or let browser handle it.
                if (err.code === err.PERMISSION_DENIED && watchId.current !== null) {
                    navigator.geolocation.clearWatch(watchId.current);
                    watchId.current = null;
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 10000
            }
        );
    }, [updateLocation]);

    // Auto-start watcher on mount (only if welcome modal was already seen or skipped)
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const params = new URLSearchParams(window.location.search);
        const skipTutorial = params.has('skipTutorial');
        const welcomeSeen = localStorage.getItem(STORAGE_KEYS.WELCOME_SEEN);

        if (welcomeSeen || skipTutorial) {
            startWatcher();
        }

        return () => {
            if (typeof navigator !== 'undefined' && navigator.geolocation && watchId.current !== null) {
                navigator.geolocation.clearWatch(watchId.current);
                watchId.current = null;
            }
        };
    }, [startWatcher]);

    const getFallbackLocation = useCallback((): [number, number] | null => {
        const saved = localStorage.getItem(STORAGE_KEYS.LAST_LOCATION);
        if (saved) {
            try {
                const { lat, lng } = JSON.parse(saved);
                if (typeof lat === 'number' && typeof lng === 'number') {
                    return [lng, lat];
                }
            } catch {
                // Ignore parse errors
            }
        }
        return null;
    }, []);

    const handleLocate = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }

        const now = Date.now();
        const isStale = now - lastUpdatedAt.current > 20000; // 20 seconds threshold

        if (userLocation && !isStale) {
            flyToLocation(userLocation);
            // Ensure watcher is still active
            if (watchId.current === null) startWatcher();
            return;
        }

        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            showToast(t('toasts.geoNotSupported'), 'error');
            const fallback = getFallbackLocation();
            if (fallback) flyToLocation(fallback);
            return;
        }

        setIsGeoPending(true);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
                updateLocation(pos);
                setIsGeoPending(false);
                flyToLocation(coords);
            },
            () => {
                setIsGeoPending(false);
                showToast(t('toasts.geoError'), 'error');
                const fallback = getFallbackLocation();
                if (fallback) flyToLocation(fallback);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );

        // Ensure watcher is still active
        if (watchId.current === null) startWatcher();
    }, [userLocation, flyToLocation, updateLocation, startWatcher, showToast, t, getFallbackLocation]);

    return {
        userLocation,
        userSpeed,
        isGeoPending,
        handleLocate,
        performGeolocation: startWatcher
    };
};
