
import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { STORAGE_KEYS } from '../../config/constants';

/**
 * useGeolocation
 *
 * Handles user position tracking and auto-location logic.
 * No longer directly mutates the map (control inverted through onFlyRequest).
 */
export const useGeolocation = (onFlyRequest: (location: [number, number], isJump?: boolean) => void, mapLoaded: boolean = false) => {
    const { t } = useTranslation();
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [userSpeed, setUserSpeed] = useState<number | null>(null);
    const [isGeoPending, setIsGeoPending] = useState(false);

    const watchId = useRef<number | null>(null);
    const lastUpdatedAt = useRef<number>(0);
    const isInitialFocused = useRef(false);

    const updateLocation = useCallback((pos: GeolocationPosition) => {
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setUserLocation(coords);
        setUserSpeed(pos.coords.speed);
        lastUpdatedAt.current = Date.now();
        localStorage.setItem(STORAGE_KEYS.LAST_LOCATION, JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }));
    }, []);

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

    // Initial map focus once both map and location are ready
    useEffect(() => {
        if (mapLoaded && userLocation && !isInitialFocused.current) {
            const p = new URLSearchParams(window.location.search);
            const hasExplicitLocation = p.has('lat') || p.has('lng') || p.has('stopId') || p.has('tripId');
            if (!hasExplicitLocation) {
                onFlyRequest(userLocation, true);
            }
            isInitialFocused.current = true;
        }
    }, [mapLoaded, userLocation, onFlyRequest]);

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
        if (isGeoPending) return;

        const now = Date.now();
        // Trust the watcher more: if we have a location from the last 10 seconds, use it.
        const isFreshEnough = now - lastUpdatedAt.current < 10000;

        if (userLocation && isFreshEnough) {
            onFlyRequest(userLocation);
            // Ensure watcher is still active (it should be, but just in case)
            if (watchId.current === null) startWatcher();
            return;
        }

        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            toast.error(t('toasts.geoNotSupported'));
            const fallback = getFallbackLocation();
            if (fallback) onFlyRequest(fallback);
            return;
        }

        setIsGeoPending(true);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
                updateLocation(pos);
                setIsGeoPending(false);
                onFlyRequest(coords);
            },
            () => {
                setIsGeoPending(false);
                toast.error(t('toasts.geoError'));
                const fallback = getFallbackLocation();
                if (fallback) onFlyRequest(fallback);
            },
            { 
                enableHighAccuracy: true, 
                timeout: 10000, 
                maximumAge: 5000 // 5 seconds grace period to avoid triggering OS privacy prompts and cold-starting GPS
            }
        );

        // Ensure watcher is still active
        if (watchId.current === null) startWatcher();
    }, [userLocation, isGeoPending, onFlyRequest, updateLocation, startWatcher, t, getFallbackLocation]);

    return {
        userLocation,
        userSpeed,
        isGeoPending,
        handleLocate,
        performGeolocation: startWatcher
    };
};
