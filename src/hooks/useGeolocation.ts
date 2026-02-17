
import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from './useToast';
import type { MapRef } from 'react-map-gl/maplibre';
import { LS_KEYS, MAP_USER_LOCATION_ZOOM, MAP_FLY_DURATION_MS } from '../config/constants';

export const useGeolocation = (mapRef: React.RefObject<MapRef | null>) => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const watchId = useRef<number | null>(null);
    const isInitialSet = useRef(false);
    const userLocationRef = useRef<[number, number] | null>(null);
    const pendingManualFly = useRef(false);

    // Keep ref in sync for use in callbacks without triggering re-renders
    useEffect(() => {
        userLocationRef.current = userLocation;
    }, [userLocation]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (watchId.current !== null) {
                navigator.geolocation.clearWatch(watchId.current);
            }
        };
    }, []);

    const performGeolocation = useCallback((isManual: boolean = true) => {
        if (!navigator.geolocation) {
            console.error('❌ Geolocation is not supported by this browser.');
            if (isManual) showToast(t('toasts.geoNotSupported'), 'error');
            return;
        }

        if (isManual) {
            if (userLocationRef.current) {
                console.log('🎯 Manual locate: Flying to current known location');
                mapRef.current?.getMap().flyTo({
                    center: userLocationRef.current,
                    zoom: MAP_USER_LOCATION_ZOOM,
                    duration: MAP_FLY_DURATION_MS
                });
            } else {
                console.log('⏳ Manual locate: Pending position fix...');
                pendingManualFly.current = true;
            }
        }

        if (watchId.current !== null) {
            return;
        }

        const mode = isManual ? 'manual' : 'auto';
        console.log(`🛰️ Starting ${mode} geolocation watch...`);

        watchId.current = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude, accuracy } = pos.coords;
                console.log(`✅ Position updated: ${latitude}, ${longitude} (accuracy: ${Math.round(accuracy)}m)`);

                const newLocation: [number, number] = [longitude, latitude];
                setUserLocation(newLocation);

                // Persist to localStorage
                localStorage.setItem(LS_KEYS.LAST_USER_LOCATION, JSON.stringify({ lat: latitude, lng: longitude }));

                // Handle initial positioning
                if (!isInitialSet.current) {
                    const p = new URLSearchParams(window.location.search);
                    const hasParams = p.has('lat') || p.has('lng') || p.has('stopId') || p.has('tripId');

                    if (!hasParams && !isManual) {
                        console.log('🚀 Initial lock: Snapping map to user location');
                        mapRef.current?.getMap().jumpTo({
                            center: newLocation,
                            zoom: MAP_USER_LOCATION_ZOOM
                        });
                    }
                    isInitialSet.current = true;
                }

                // If there was a pending manual request, fly now
                if (pendingManualFly.current) {
                    console.log('🎯 Position acquired: Executing pending flyTo');
                    mapRef.current?.getMap().flyTo({
                        center: newLocation,
                        zoom: MAP_USER_LOCATION_ZOOM,
                        duration: MAP_FLY_DURATION_MS
                    });
                    pendingManualFly.current = false;
                }
            },
            (err) => {
                // Detailed logging for GeolocationPositionError
                const errorTypes: Record<number, string> = {
                    [err.PERMISSION_DENIED]: 'PERMISSION_DENIED',
                    [err.POSITION_UNAVAILABLE]: 'POSITION_UNAVAILABLE',
                    [err.TIMEOUT]: 'TIMEOUT'
                };
                const errorType = errorTypes[err.code] || 'UNKNOWN_ERROR';
                console.error(`❌ Geolocation error: ${errorType} (${err.code}) - ${err.message}`);

                // Clear watch on error so subsequent manual attempts can try again
                if (watchId.current !== null) {
                    navigator.geolocation.clearWatch(watchId.current);
                    watchId.current = null;
                }

                if (isManual || pendingManualFly.current) {
                    showToast(t('toasts.geoError'), 'error');
                    pendingManualFly.current = false;
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    }, [mapRef, showToast, t]);

    const handleLocate = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        performGeolocation(true);
    }, [performGeolocation]);

    return {
        userLocation,
        performGeolocation,
        handleLocate
    };
};
