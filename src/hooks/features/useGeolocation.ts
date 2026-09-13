import { useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import i18n from '../../i18n/config';
import { MAP_CAMERA, GEOLOCATION_TIMING_MS } from '../../config/constants';
import { useGeolocationStore } from '../../state/geolocationStore';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useMapMetadataStore } from '../../state/mapMetadataStore';

const hasGeolocation = () => typeof navigator !== 'undefined' && !!navigator.geolocation;

const applyPosition = (pos: GeolocationPosition) => {
    const actions = useGeolocationStore.getState().actions;
    actions.setUserLocation([pos.coords.longitude, pos.coords.latitude]);
    actions.setUserSpeed(pos.coords.speed);
    actions.setLastUpdatedAt(Date.now());
    actions.setIsGeoPending(false);
    actions.setLastLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
};

const stopLocationWatch = () => {
    const { watchId, actions } = useGeolocationStore.getState();
    if (watchId === null || !hasGeolocation()) return;
    navigator.geolocation.clearWatch(watchId);
    actions.setWatchId(null);
};

/** Starts the app-wide position watch unless one is already running. */
const startLocationWatch = () => {
    const { watchId, actions } = useGeolocationStore.getState();
    if (watchId !== null || !hasGeolocation()) return;

    const id = navigator.geolocation.watchPosition(
        applyPosition,
        (err) => {
            useGeolocationStore.getState().actions.setIsGeoPending(false);
            if (err.code === err.PERMISSION_DENIED) stopLocationWatch();
        },
        { enableHighAccuracy: true, timeout: GEOLOCATION_TIMING_MS.WATCH_TIMEOUT, maximumAge: GEOLOCATION_TIMING_MS.WATCH_MAX_AGE }
    );
    actions.setWatchId(id);
};

/**
 * Owns the position watch and the first jump to the user's location. Mount exactly once (MapController).
 */
export const useGeolocationWatcher = () => {
    const hasSeenWelcome = usePreferencesStore(s => s.hasSeenWelcome);
    const userLocation = useGeolocationStore(s => s.userLocation);
    const mapLoaded = useMapMetadataStore(s => s.mapLoaded);
    const mapRef = useMapMetadataStore(s => s.mapRef);
    const hasFocusedOnUser = useRef(false);

    useEffect(() => {
        const skipTutorial = new URLSearchParams(window.location.search).has('skipTutorial');
        if (!hasSeenWelcome && !skipTutorial) return;
        startLocationWatch();
        return stopLocationWatch;
    }, [hasSeenWelcome]);

    useEffect(() => {
        if (hasFocusedOnUser.current || !mapLoaded || !userLocation || !mapRef.current) return;

        const p = new URLSearchParams(window.location.search);
        const path = window.location.pathname;
        const hasExplicitLocation = p.has('lat') || p.has('lng') || p.has('stopId') || p.has('tripId') || path.includes('/stop/') || path.includes('/trip/');

        hasFocusedOnUser.current = true;
        if (!hasExplicitLocation) {
            mapRef.current.getMap().jumpTo({ center: userLocation, zoom: MAP_CAMERA.VEHICLE_SELECT_ZOOM });
        }
    }, [mapLoaded, userLocation, mapRef]);
};

/**
 * Returns a handler that flies the map to the user, requesting a fresh fix when the last one is stale.
 * It reads state at call time, so components using it don't re-render on every position update.
 */
export const useLocate = () => {
    const mapRef = useMapMetadataStore(s => s.mapRef);

    return useCallback((e?: React.MouseEvent | React.TouchEvent) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }

        const { isGeoPending, userLocation, lastUpdatedAt, lastLocation, actions } = useGeolocationStore.getState();
        if (isGeoPending) return;

        const map = mapRef.current?.getMap();
        const flyToLastLocation = () => {
            if (lastLocation && map) {
                map.flyTo({ center: [lastLocation.lng, lastLocation.lat], zoom: MAP_CAMERA.VEHICLE_SELECT_ZOOM, duration: MAP_CAMERA.FLY_MS });
            }
        };

        if (userLocation && Date.now() - lastUpdatedAt < GEOLOCATION_TIMING_MS.FRESH_FIX) {
            map?.flyTo({ center: userLocation, zoom: MAP_CAMERA.VEHICLE_SELECT_ZOOM, duration: MAP_CAMERA.FLY_MS });
            startLocationWatch();
            return;
        }

        if (!hasGeolocation()) {
            toast.error(i18n.t('toasts.geoNotSupported'));
            flyToLastLocation();
            return;
        }

        actions.setIsGeoPending(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                applyPosition(pos);
                map?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: MAP_CAMERA.VEHICLE_SELECT_ZOOM, duration: MAP_CAMERA.FLY_MS });
            },
            () => {
                useGeolocationStore.getState().actions.setIsGeoPending(false);
                toast.error(i18n.t('toasts.geoError'));
                flyToLastLocation();
            },
            { enableHighAccuracy: true, timeout: GEOLOCATION_TIMING_MS.ONE_SHOT_TIMEOUT, maximumAge: GEOLOCATION_TIMING_MS.ONE_SHOT_MAX_AGE }
        );

        startLocationWatch();
    }, [mapRef]);
};
