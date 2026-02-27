
import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from './useToast';
import type { Map } from 'maplibre-gl';
import { MAP_FLY_DURATION, MAP_VEHICLE_SELECT_ZOOM, STORAGE_KEYS } from '../config/constants';

export const useGeolocation = (mapRef: React.RefObject<Map | null>) => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [isGeoPending, setIsGeoPending] = useState(false);

    const watchId = useRef<number | null>(null);
    const lastUpdatedAt = useRef<number>(0);
    const isInitialSet = useRef(false);

    // Helper to fly the map to a location
    const flyToLocation = useCallback((location: [number, number], isJump: boolean = false) => {
        const map = mapRef.current;
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
        lastUpdatedAt.current = Date.now();
        localStorage.setItem(STORAGE_KEYS.LAST_LOCATION, JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }));

        // Initial map focus (only if no coordinates or specific stops/trips are in URL)
        if (!isInitialSet.current) {
            const p = new URLSearchParams(window.location.search);
            const hasExplicitLocation = p.has('lat') || p.has('lng') || p.has('stopId') || p.has('tripId');
            if (!hasExplicitLocation) {
                console.log('🚀 Initial geolocation lock: Snapping map to user');
                flyToLocation(coords, true);
            }
            isInitialSet.current = true;
        }
    }, [flyToLocation]);

    const startWatcher = useCallback(() => {
        if (!navigator.geolocation || watchId.current !== null) return;

        console.log('🛰️ Starting geolocation watcher...');
        watchId.current = navigator.geolocation.watchPosition(
            (pos) => {
                updateLocation(pos);
                setIsGeoPending(false);
            },
            (err) => {
                console.error(`❌ Geolocation error (${err.code}): ${err.message}`);
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

    // Auto-start watcher on mount
    useEffect(() => {
        startWatcher();
        return () => {
            if (watchId.current !== null) {
                navigator.geolocation.clearWatch(watchId.current);
                watchId.current = null;
            }
        };
    }, [startWatcher]);

    const handleLocate = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }

        const now = Date.now();
        const isStale = now - lastUpdatedAt.current > 20000; // 20 seconds threshold

        if (userLocation && !isStale) {
            console.log('🎯 Manual locate: Flying to current known location');
            flyToLocation(userLocation);
        } else {
            console.log('⏳ Manual locate: Requesting fresh position...');
            setIsGeoPending(true);
            showToast(t('toasts.geoSearching'), 'info');

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
                    updateLocation(pos);
                    setIsGeoPending(false);
                    flyToLocation(coords);
                },
                (err) => {
                    console.error('❌ Manual location fix failed:', err);
                    setIsGeoPending(false);
                    showToast(t('toasts.geoError'), 'error');
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        }

        // Ensure watcher is still active
        if (watchId.current === null) startWatcher();
    }, [userLocation, flyToLocation, updateLocation, startWatcher, showToast, t]);

    return {
        userLocation,
        isGeoPending,
        handleLocate,
        performGeolocation: startWatcher
    };
};
