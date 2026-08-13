import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import i18n from '../../i18n/config';
import { MAP_VEHICLE_SELECT_ZOOM, MAP_FLY_DURATION } from '../../config/constants';
import { useGeolocationStore } from '../../state/geolocationStore';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useMapMetadataStore } from '../../state/mapMetadataStore';

export const useGeolocation = () => {
    const watchId = useGeolocationStore(s => s.watchId);
    const userLocation = useGeolocationStore(s => s.userLocation);
    const isGeoPending = useGeolocationStore(s => s.isGeoPending);
    const lastUpdatedAt = useGeolocationStore(s => s.lastUpdatedAt);
    
    const lastLocation = useGeolocationStore(s => s.lastLocation);
    const hasSeenWelcome = usePreferencesStore(s => s.hasSeenWelcome);
    
    const { 
        setUserLocation, 
        setUserSpeed, 
        setLastUpdatedAt, 
        setIsGeoPending, 
        setWatchId,
        setLastLocation
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
                setLastLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
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
    }, [watchId, setUserLocation, setUserSpeed, setLastUpdatedAt, setIsGeoPending, setWatchId, setLastLocation]);

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
            if (lastLocation && map) {
                map.flyTo({ center: [lastLocation.lng, lastLocation.lat], zoom: MAP_VEHICLE_SELECT_ZOOM, duration: MAP_FLY_DURATION });
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
                setLastLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                if (map) map.flyTo({ center: coords, zoom: MAP_VEHICLE_SELECT_ZOOM, duration: MAP_FLY_DURATION });
            },
            () => {
                setIsGeoPending(false);
                toast.error(i18n.t('toasts.geoError'));
                if (lastLocation && map) {
                    map.flyTo({ center: [lastLocation.lng, lastLocation.lat], zoom: MAP_VEHICLE_SELECT_ZOOM, duration: MAP_FLY_DURATION });
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
        );

        if (watchId === null) performGeolocation();
    }, [isGeoPending, lastUpdatedAt, userLocation, watchId, mapRef, performGeolocation, setUserLocation, setUserSpeed, setLastUpdatedAt, setIsGeoPending, lastLocation, setLastLocation]);

    // Auto-start watcher on mount
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const params = new URLSearchParams(window.location.search);
        const skipTutorial = params.has('skipTutorial');

        if (hasSeenWelcome || skipTutorial) {
            performGeolocation();
        }

        return () => {
            if (typeof navigator !== 'undefined' && navigator.geolocation && watchId !== null) {
                navigator.geolocation.clearWatch(watchId);
                setWatchId(null);
            }
        };
    }, [performGeolocation, watchId, setWatchId, hasSeenWelcome]);

    // Initial map focus
    useEffect(() => {
        if (mapLoaded && userLocation && mapRef.current) {
            const map = mapRef.current.getMap();
            const p = new URLSearchParams(window.location.search);
            const path = window.location.pathname;
            const hasExplicitLocation = p.has('lat') || p.has('lng') || p.has('stopId') || p.has('tripId') || path.includes('/stop/') || path.includes('/trip/');

            if (!hasExplicitLocation && !sessionStorage.getItem('initial_geo_focus')) {
                map.jumpTo({ center: userLocation, zoom: MAP_VEHICLE_SELECT_ZOOM });
                sessionStorage.setItem('initial_geo_focus', 'true');
            }
        }
    }, [mapLoaded, userLocation, mapRef]);

    return { performGeolocation, handleLocate };
};
