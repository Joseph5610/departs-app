
import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../components/Toast';
import type { MapRef } from 'react-map-gl/maplibre';

export const useGeolocation = (mapRef: React.RefObject<MapRef | null>) => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const isLocating = useRef(false);

    const performGeolocation = useCallback((isManual: boolean = true) => {
        if (isLocating.current) {
            console.log(`⏳ Geolocation already in progress (requested as ${isManual ? 'manual' : 'auto'}), skipping...`);
            return;
        }

        const mode = isManual ? 'manual' : 'auto';
        console.log(`🛰️ Starting ${mode} geolocation...`);

        if (!navigator.geolocation) {
            console.error('❌ Geolocation is not supported by this browser.');
            if (isManual) showToast(t('toasts.geoNotSupported'), 'error');
            return;
        }

        isLocating.current = true;
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                isLocating.current = false;
                const { latitude, longitude, accuracy } = pos.coords;
                console.log(`✅ Position found: ${latitude}, ${longitude} (accuracy: ${Math.round(accuracy)}m)`);
                setUserLocation([longitude, latitude]);
                mapRef.current?.getMap().flyTo({
                    center: [longitude, latitude],
                    zoom: 15,
                    duration: 2000
                });
            },
            (err) => {
                isLocating.current = false;
                // Detailed logging for GeolocationPositionError
                const errorTypes = {
                    [err.PERMISSION_DENIED]: 'PERMISSION_DENIED',
                    [err.POSITION_UNAVAILABLE]: 'POSITION_UNAVAILABLE',
                    [err.TIMEOUT]: 'TIMEOUT'
                };
                const errorType = (errorTypes as any)[err.code] || 'UNKNOWN_ERROR';
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
