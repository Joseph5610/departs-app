
import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../components/Toast';
import type { MapRef } from 'react-map-gl/maplibre';

export const useGeolocation = (mapRef: React.RefObject<MapRef | null>) => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const watchId = useRef<number | null>(null);
    const isInitialSet = useRef(false);
    const userLocationRef = useRef<[number, number] | null>(null);

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

        // If manual click and we already have a location, fly there immediately
        if (isManual && userLocationRef.current) {
            console.log('🎯 Manual locate: Flying to current known location');
            mapRef.current?.getMap().flyTo({
                center: userLocationRef.current,
                zoom: 15,
                duration: 2000
            });
            // We still continue to ensure the watch is active if it somehow wasn't
        }

        if (watchId.current !== null) {
            console.log('📡 Already watching position.');
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
                localStorage.setItem('lastUserLocation', JSON.stringify({ lat: latitude, lng: longitude }));

                // Handle initial positioning
                if (!isInitialSet.current) {
                    const p = new URLSearchParams(window.location.search);
                    const hasParams = p.has('lat') || p.has('lng') || p.has('stopId') || p.has('tripId');

                    if (!hasParams && !isManual) {
                        console.log('🚀 Initial lock: Snapping map to user location');
                        mapRef.current?.getMap().jumpTo({
                            center: newLocation,
                            zoom: 15
                        });
                    }
                    isInitialSet.current = true;
                }

                // If this was a manual request and we didn't have a location before, fly now
                if (isManual && !userLocationRef.current) {
                    mapRef.current?.getMap().flyTo({
                        center: newLocation,
                        zoom: 15,
                        duration: 2000
                    });
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

                if (isManual) {
                    showToast(t('toasts.geoError'), 'error');
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
