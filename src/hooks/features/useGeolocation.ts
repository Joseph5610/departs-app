import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import i18n from '../../i18n/config';
import { STORAGE_KEYS, MAP_VEHICLE_SELECT_ZOOM, MAP_FLY_DURATION } from '../../config/constants';
import { useGeolocationStore } from '../../state/geolocationStore';
import { useMapMetadataStore } from '../../state/mapMetadataStore';

export const useGeolocation = () => {
    const watchId = useGeolocationStore(s => s.watchId);
    const userLocation = useGeolocationStore(s => s.userLocation);
    const isGeoPending = useGeolocationStore(s => s.isGeoPending);
    const lastUpdatedAt = useGeolocationStore(s => s.lastUpdatedAt);
    
    const { 
        setUserLocation, 
        setUserSpeed, 
        setLastUpdatedAt, 
        setIsGeoPending, 
        setWatchId 
    } = useGeolocationStore(s => s.actions);

    const mapLoaded = useMapMetadataStore(s => s.mapLoaded);
    const mapRef = useMapMetadataStore(s => s.mapRef);

    const performGeolocation = useCallback(() => {
        if (typeof navigator === 'undefined' || !navigator.geolocation || watchId !== null) return;

        const id = navigator.geolocation.watchPosition(
            (pos) => {
                const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
                setUserLocation(coords);
                setUserSpeed(pos.coords.speed);
                setLastUpdatedAt(Date.now());
                setIsGeoPending(false);
                localStorage.setItem(STORAGE_KEYS.LAST_LOCATION, JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }));
            },
            (err) => {
                setIsGeoPending(false);
                if (err.code === err.PERMISSION_DENIED) {
                    if (watchId !== null) {
                        navigator.geolocation.clearWatch(watchId);
                        setWatchId(null);
                    }
                }
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
        setWatchId(id);
    }, [watchId, setUserLocation, setUserSpeed, setLastUpdatedAt, setIsGeoPending, setWatchId]);

    const handleLocate = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        if (isGeoPending) return;

        const map = mapRef.current?.getMap();
        const now = Date.now();
        const isFreshEnough = now - lastUpdatedAt < 10000;

        if (userLocation && isFreshEnough) {
            if (map) map.flyTo({ center: userLocation, zoom: MAP_VEHICLE_SELECT_ZOOM, duration: MAP_FLY_DURATION });
            if (watchId === null) performGeolocation();
            return;
        }

        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            toast.error(i18n.t('toasts.geoNotSupported'));
            const saved = localStorage.getItem(STORAGE_KEYS.LAST_LOCATION);
            if (saved && map) {
                try {
                    const { lat, lng } = JSON.parse(saved);
                    map.flyTo({ center: [lng, lat], zoom: MAP_VEHICLE_SELECT_ZOOM, duration: MAP_FLY_DURATION });
                } catch (e) { console.warn('Failed to parse saved LAST_LOCATION', e); }
            }
            return;
        }

        setIsGeoPending(true);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
                setUserLocation(coords);
                setUserSpeed(pos.coords.speed);
                setLastUpdatedAt(Date.now());
                setIsGeoPending(false);
                if (map) map.flyTo({ center: coords, zoom: MAP_VEHICLE_SELECT_ZOOM, duration: MAP_FLY_DURATION });
            },
            () => {
                setIsGeoPending(false);
                toast.error(i18n.t('toasts.geoError'));
                const saved = localStorage.getItem(STORAGE_KEYS.LAST_LOCATION);
                if (saved && map) {
                    try {
                        const { lat, lng } = JSON.parse(saved);
                        map.flyTo({ center: [lng, lat], zoom: MAP_VEHICLE_SELECT_ZOOM, duration: MAP_FLY_DURATION });
                    } catch (e) { console.warn('Failed to parse saved LAST_LOCATION during zoom check', e); }
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
        );

        if (watchId === null) performGeolocation();
    }, [isGeoPending, lastUpdatedAt, userLocation, watchId, mapRef, performGeolocation, setUserLocation, setUserSpeed, setLastUpdatedAt, setIsGeoPending]);

    // Auto-start watcher on mount
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const params = new URLSearchParams(window.location.search);
        const skipTutorial = params.has('skipTutorial');
        const welcomeSeen = localStorage.getItem(STORAGE_KEYS.WELCOME_SEEN);

        if (welcomeSeen || skipTutorial) {
            performGeolocation();
        }

        return () => {
            if (typeof navigator !== 'undefined' && navigator.geolocation && watchId !== null) {
                navigator.geolocation.clearWatch(watchId);
                setWatchId(null);
            }
        };
    }, [performGeolocation, watchId, setWatchId]);

    // Initial map focus
    useEffect(() => {
        if (mapLoaded && userLocation && mapRef.current) {
            const map = mapRef.current.getMap();
            const p = new URLSearchParams(window.location.search);
            const hasExplicitLocation = p.has('lat') || p.has('lng') || p.has('stopId') || p.has('tripId');

            if (!hasExplicitLocation && !sessionStorage.getItem('initial_geo_focus')) {
                map.jumpTo({ center: userLocation, zoom: MAP_VEHICLE_SELECT_ZOOM });
                sessionStorage.setItem('initial_geo_focus', 'true');
            }
        }
    }, [mapLoaded, userLocation, mapRef]);

    return { performGeolocation, handleLocate };
};
