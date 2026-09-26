import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { MapRef } from 'react-map-gl/maplibre';
import i18n from '../../i18n/config';
import { MAP_CAMERA, GEOLOCATION_TIMING_MS } from '../../config/constants';
import { useGeolocationStore, type FocusRequest } from '../../state/geolocationStore';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useMapMetadataStore } from '../../state/mapMetadataStore';
import { useVisibleCities } from '../data/useCities';
import { navigate } from '../../lib/history';
import { paths } from '../../lib/routes';
import { findCityAt } from '../../utils/mapUtils';
import type { City } from '../../types/cities';

const hasGeolocation = () => typeof navigator !== 'undefined' && !!navigator.geolocation;

/** Only asks the Permissions API, so it never triggers a prompt; unsupported browsers count as not granted. */
const isLocationGranted = async () => {
    try {
        return (await navigator.permissions?.query({ name: 'geolocation' }))?.state === 'granted';
    } catch {
        return false;
    }
};

const hasExplicitLocationInUrl = () => {
    const p = new URLSearchParams(window.location.search);
    const path = window.location.pathname;
    return p.has('lat') || p.has('lng') || p.has('stopId') || p.has('tripId') || path.includes('/stop/') || path.includes('/trip/');
};

const applyPosition = (pos: GeolocationPosition) => {
    const actions = useGeolocationStore.getState().actions;
    actions.setUserLocation([pos.coords.longitude, pos.coords.latitude]);
    actions.setUserSpeed(pos.coords.speed);
    actions.setLastUpdatedAt(Date.now());
    actions.setLastLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
};

/** Ends a pending focus request; a failed locate tap is reported and falls back to the last saved location. */
const failFocusRequest = () => {
    const { focusRequest, lastLocation, actions } = useGeolocationStore.getState();
    if (!focusRequest) return;
    actions.requestFocus(null);
    if (focusRequest !== 'locate') return;

    toast.error(i18n.t('toasts.geoError'));
    const map = useMapMetadataStore.getState().mapRef.current?.getMap();
    if (lastLocation && map) {
        map.flyTo({ center: [lastLocation.lng, lastLocation.lat], zoom: MAP_CAMERA.VEHICLE_SELECT_ZOOM, duration: MAP_CAMERA.FLY_MS });
    }
};

const stopLocationWatch = () => {
    const { watchId, actions } = useGeolocationStore.getState();
    if (watchId === null || !hasGeolocation()) return;
    navigator.geolocation.clearWatch(watchId);
    actions.setWatchId(null);
};

/** Starts the app-wide position watch unless one is already running. It is the only place that asks for location. */
const startLocationWatch = () => {
    const { watchId, actions } = useGeolocationStore.getState();
    if (watchId !== null || !hasGeolocation()) return;

    const id = navigator.geolocation.watchPosition(
        applyPosition,
        (err) => {
            if (err.code !== err.PERMISSION_DENIED) return;
            stopLocationWatch();
            failFocusRequest();
        },
        { enableHighAccuracy: true, timeout: GEOLOCATION_TIMING_MS.WATCH_TIMEOUT, maximumAge: GEOLOCATION_TIMING_MS.WATCH_MAX_AGE }
    );
    actions.setWatchId(id);
};

/** Moves the map to the next fresh fix, starting the watch if needed. */
const requestFocus = (request: FocusRequest) => {
    const { actions } = useGeolocationStore.getState();
    actions.requestFocus(request);
    const requestedAt = useGeolocationStore.getState().focusRequestedAt;
    setTimeout(() => {
        if (useGeolocationStore.getState().focusRequestedAt === requestedAt) failFocusRequest();
    }, GEOLOCATION_TIMING_MS.FOCUS_TIMEOUT);
    startLocationWatch();
};

/**
 * Centres the map on the user. A locate tap goes anywhere, selecting the city it lands in so its data loads;
 * an automatic focus only moves within the selected city, so a city the user picked is never overridden.
 */
const focusOnUser = (map: ReturnType<MapRef['getMap']>, location: [number, number], cities: City[], request: FocusRequest) => {
    const camera = { center: location, zoom: MAP_CAMERA.VEHICLE_SELECT_ZOOM };
    const city = findCityAt(cities, location);

    const { selectedCity, actions } = usePreferencesStore.getState();
    if (request === 'auto') {
        if (city?.slug === selectedCity) map.jumpTo(camera);
        return;
    }

    if (city && city.slug !== selectedCity) {
        // Jump before switching, so useAutoCitySwitch sees the map already inside the new city and doesn't fly to its overview.
        map.jumpTo(camera);
        actions.setSelectedCity(city.slug);
        navigate(paths.city(city.slug), { replace: true });
        return;
    }

    map.flyTo({ ...camera, duration: MAP_CAMERA.FLY_MS });
};

/**
 * Owns the position watch and moves the map when a fix answers a focus request. Mount exactly once (MapController).
 * At launch it only watches when permission is already granted, so opening the app never shows a prompt.
 */
export const useGeolocationWatcher = () => {
    const userLocation = useGeolocationStore(s => s.userLocation);
    const lastUpdatedAt = useGeolocationStore(s => s.lastUpdatedAt);
    const focusRequest = useGeolocationStore(s => s.focusRequest);
    const focusRequestedAt = useGeolocationStore(s => s.focusRequestedAt);
    const mapLoaded = useMapMetadataStore(s => s.mapLoaded);
    const mapRef = useMapMetadataStore(s => s.mapRef);
    const cities = useVisibleCities();

    useEffect(() => {
        let cancelled = false;
        if (usePreferencesStore.getState().hasSeenWelcome) {
            void isLocationGranted().then(granted => {
                if (!granted || cancelled) return;
                if (hasExplicitLocationInUrl()) startLocationWatch();
                else requestFocus('auto');
            });
        }
        return () => {
            cancelled = true;
            stopLocationWatch();
        };
    }, []);

    useEffect(() => {
        const map = mapRef.current?.getMap();
        if (!focusRequest || !userLocation || !mapLoaded || !map || cities.length === 0) return;
        if (lastUpdatedAt < focusRequestedAt - GEOLOCATION_TIMING_MS.FRESH_FIX) return;

        useGeolocationStore.getState().actions.requestFocus(null);
        focusOnUser(map, userLocation, cities, focusRequest);
    }, [focusRequest, focusRequestedAt, userLocation, lastUpdatedAt, mapLoaded, mapRef, cities]);
};

/** Returns a handler that flies the map to the user once a fresh fix is available. */
export const useLocate = () => {
    return useCallback((e?: React.MouseEvent | React.TouchEvent) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        if (useGeolocationStore.getState().focusRequest === 'locate') return;

        if (!hasGeolocation()) {
            toast.error(i18n.t('toasts.geoNotSupported'));
            return;
        }
        requestFocus('locate');
    }, []);
};

/** Asks for location after the welcome screen; the map only moves to the fix if it is inside the city picked there. */
export const locateAfterWelcome = () => {
    if (hasGeolocation()) requestFocus('auto');
};
