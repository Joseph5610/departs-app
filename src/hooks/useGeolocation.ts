
import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from './useToast';
import type { MapRef } from 'react-map-gl/maplibre';
import { MAP_FLY_DURATION, MAP_VEHICLE_SELECT_ZOOM, STORAGE_KEYS } from '../config/constants';

export const useGeolocation = (mapRef: React.RefObject<MapRef | null>) => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [isGeoPending, setIsGeoPending] = useState(false);
    const watchId = useRef<number | null>(null);
    const isInitialSet = useRef(false);
    const userLocationRef = useRef<[number, number] | null>(null);
    const lastUpdatedAt = useRef<number>(0);
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

        const now = Date.now();
        const isStale = now - lastUpdatedAt.current > 30000; // 30 seconds

        if (isManual) {
            if (userLocationRef.current && !isStale) {
                console.log('🎯 Manual locate: Flying to current known location');
                mapRef.current?.getMap().flyTo({
                    center: userLocationRef.current,
                    zoom: MAP_VEHICLE_SELECT_ZOOM,
                    duration: MAP_FLY_DURATION
                });
            } else {
                console.log('⏳ Manual locate: Requesting fresh position...');
                pendingManualFly.current = true;
                setIsGeoPending(true);
                showToast(t('toasts.geoSearching'), 'info');

                // Force a fresh position check if we have an active watch but it's stale
                if (watchId.current !== null) {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => {
                            const { latitude, longitude } = pos.coords;
                            const newLocation: [number, number] = [longitude, latitude];
                            setUserLocation(newLocation);
                            setIsGeoPending(false);
                            lastUpdatedAt.current = Date.now();

                            if (pendingManualFly.current) {
                                mapRef.current?.getMap().flyTo({
                                    center: newLocation,
                                    zoom: MAP_VEHICLE_SELECT_ZOOM,
                                    duration: MAP_FLY_DURATION
                                });
                                pendingManualFly.current = false;
                            }
                        },
                        (err) => {
                            console.error('❌ Manual getCurrentPosition error:', err);
                            setIsGeoPending(false);
                            if (pendingManualFly.current) {
                                showToast(t('toasts.geoError'), 'error');
                                pendingManualFly.current = false;
                            }
                        },
                        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
                    );
                }
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
                setIsGeoPending(false);
                lastUpdatedAt.current = Date.now();

                // Persist to localStorage
                localStorage.setItem(STORAGE_KEYS.LAST_LOCATION, JSON.stringify({ lat: latitude, lng: longitude }));

                // Handle initial positioning
                if (!isInitialSet.current) {
                    const p = new URLSearchParams(window.location.search);
                    const hasParams = p.has('lat') || p.has('lng') || p.has('stopId') || p.has('tripId');

                    if (!hasParams && !isManual) {
                        console.log('🚀 Initial lock: Snapping map to user location');
                        mapRef.current?.getMap().jumpTo({
                            center: newLocation,
                            zoom: MAP_VEHICLE_SELECT_ZOOM
                        });
                    }
                    isInitialSet.current = true;
                }

                // If there was a pending manual request, fly now
                if (pendingManualFly.current) {
                    console.log('🎯 Position acquired: Executing pending flyTo');
                    mapRef.current?.getMap().flyTo({
                        center: newLocation,
                        zoom: MAP_VEHICLE_SELECT_ZOOM,
                        duration: MAP_FLY_DURATION
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

                setIsGeoPending(false);
                // Only clear watch on permission denied.
                // For timeouts/unavailable, we keep the watch alive to recover automatically.
                if (err.code === err.PERMISSION_DENIED && watchId.current !== null) {
                    navigator.geolocation.clearWatch(watchId.current);
                    watchId.current = null;
                }

                if (isManual || pendingManualFly.current) {
                    showToast(t('toasts.geoError'), 'error');
                }
                pendingManualFly.current = false;
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 10000 // Reduced from 60s to 10s for better responsiveness
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
        isGeoPending,
        performGeolocation,
        handleLocate
    };
};
