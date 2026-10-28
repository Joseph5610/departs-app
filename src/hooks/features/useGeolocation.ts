import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { MapRef } from 'react-map-gl/maplibre';
import i18n from '@/i18n/config';
import { MAP_CAMERA, GEOLOCATION_TIMING_MS, LAUNCH_VIEW } from '@/config/constants';
import { useGeolocationStore, type FocusRequest } from '@/state/geolocationStore';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useViewportStore } from '@/state/viewportStore';
import { useRideStore } from '@/state/rideStore';
import { isTripUnderway } from '@/domain/rides';
import { useMapMetadataStore } from '@/state/mapMetadataStore';
import { useVisibleCities } from '@/hooks/data/useCities';
import { useNetworkCoverage } from '@/hooks/data/useNetworkCoverage';
import { navigate } from '@/lib/history';
import { matchRoutePath, paths } from '@/lib/routes';
import { findCityAt, launchFocus } from '@/domain/cities';
import type { NetworkCoverage } from '@/types';
import type { CityFacts } from '@shared/cities';

const hasGeolocation = () => typeof navigator !== 'undefined' && !!navigator.geolocation;

/** The Permissions API's answer without ever prompting; null where the browser doesn't tell. */
const locationPermission = async (): Promise<PermissionState | null> => {
    try {
        return (await navigator.permissions?.query({ name: 'geolocation' }))?.state ?? null;
    } catch {
        return null;
    }
};

/**
 * Whether the app may look for the user without a tap: permission is granted, or they shared their location
 * before and the browser can't say (iOS home-screen apps may report "prompt" on every launch).
 */
const mayLocateWithoutTap = async () => {
    const permission = await locationPermission();
    if (permission === 'granted') return true;
    return permission !== 'denied' && useGeolocationStore.getState().locationOptIn;
};

/** A stop, trip or point of sale is open; it keeps its own city and view. */
const hasOpenEntity = () => {
    const { stopId, tripId, posId } = matchRoutePath(window.location.pathname);
    return !!(stopId || tripId || posId);
};

const applyPosition = (pos: GeolocationPosition) =>
    useGeolocationStore.getState().actions.applyFix([pos.coords.longitude, pos.coords.latitude], pos.coords.accuracy, Date.now());

/** The app-wide `watchPosition` handle; null while not watching. */
let watchId: number | null = null;

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
    if (watchId === null || !hasGeolocation()) return;
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
};

/** Starts the app-wide position watch unless one is already running. It is the only place that asks for location. */
const startLocationWatch = () => {
    if (watchId !== null || !hasGeolocation()) return;

    watchId = navigator.geolocation.watchPosition(
        applyPosition,
        (err) => {
            if (err.code !== err.PERMISSION_DENIED) return;
            stopLocationWatch();
            failFocusRequest();
        },
        { enableHighAccuracy: true, timeout: GEOLOCATION_TIMING_MS.WATCH_TIMEOUT, maximumAge: GEOLOCATION_TIMING_MS.WATCH_MAX_AGE }
    );
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
 * Centres the map on the user. A locate tap goes anywhere, selecting the city it lands in so its data loads.
 * At launch or on return the map moves onto the user and their city unless they are busy (see `launchFocus`);
 * after the welcome screen it only moves within the city picked there.
 */
const focusOnUser = (map: ReturnType<MapRef['getMap']>, location: [number, number], accuracyM: number, cities: CityFacts[], coverages: ReadonlyMap<string, NetworkCoverage>, request: FocusRequest, requestedAt: number) => {
    const { selectedCity, actions } = usePreferencesStore.getState();
    const city = findCityAt(cities, coverages, location, selectedCity);

    const switchTo = (slug: string, zoom: number) => {
        // Jump before switching, so useAutoCitySwitch sees the map already inside the new city and doesn't fly to its overview.
        map.jumpTo({ center: location, zoom });
        actions.setSelectedCity(slug);
        navigate(paths.city(slug), { replace: true });
    };

    if (request === 'launch') {
        const target = launchFocus({
            cityAtLocation: city?.slug ?? null,
            selectedCity,
            accuracyM,
            userMoved: useViewportStore.getState().userMovedAt > requestedAt,
            hasOpenEntity: hasOpenEntity(),
            hasActiveRide: useRideStore.getState().trips.some(trip => trip.city === selectedCity && isTripUnderway(trip, Date.now())),
            zoomSteps: LAUNCH_VIEW.ZOOM_BY_ACCURACY,
        });
        if (!target) return;
        if (target.switchesCity) switchTo(target.city, target.zoom);
        else map.jumpTo({ center: location, zoom: target.zoom });
        return;
    }

    const camera = { center: location, zoom: MAP_CAMERA.VEHICLE_SELECT_ZOOM };
    if (request === 'welcome') {
        if (city?.slug === selectedCity) map.jumpTo(camera);
        return;
    }

    if (city && city.slug !== selectedCity) {
        switchTo(city.slug, camera.zoom);
        return;
    }
    map.flyTo({ ...camera, duration: MAP_CAMERA.FLY_MS });
};

/** When the app last went to the background; null while it is in front. */
let hiddenSince: number | null = null;

/**
 * Owns the position watch and moves the map when a fix answers a focus request. Mount exactly once (MapController).
 * At launch, and on return after a while in the background, it looks for the user only when it may do so
 * without a prompt (see `mayLocateWithoutTap`); a link to a stop or trip keeps its view.
 */
export const useGeolocationWatcher = () => {
    const userLocation = useGeolocationStore(s => s.userLocation);
    const accuracyM = useGeolocationStore(s => s.accuracyM);
    const lastUpdatedAt = useGeolocationStore(s => s.lastUpdatedAt);
    const focusRequest = useGeolocationStore(s => s.focusRequest);
    const focusRequestedAt = useGeolocationStore(s => s.focusRequestedAt);
    const mapLoaded = useMapMetadataStore(s => s.mapLoaded);
    const mapRef = useMapMetadataStore(s => s.mapRef);
    const cities = useVisibleCities();
    const coverages = useNetworkCoverage();

    useEffect(() => {
        let cancelled = false;
        const locateIfAllowed = () => {
            if (!usePreferencesStore.getState().hasSeenWelcome) return;
            void mayLocateWithoutTap().then(allowed => {
                if (!allowed || cancelled) return;
                requestFocus('launch');
            });
        };
        locateIfAllowed();

        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                hiddenSince = Date.now();
                return;
            }
            const awayMs = hiddenSince === null ? 0 : Date.now() - hiddenSince;
            hiddenSince = null;
            if (awayMs >= LAUNCH_VIEW.RESUME_RELOCATE_AFTER_MS) {
                void mayLocateWithoutTap().then(allowed => { if (allowed && !cancelled) requestFocus('launch'); });
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', onVisibilityChange);
            stopLocationWatch();
        };
    }, []);

    useEffect(() => {
        const map = mapRef.current?.getMap();
        if (!focusRequest || !userLocation || !mapLoaded || !map || cities.length === 0) return;
        if (lastUpdatedAt < focusRequestedAt - GEOLOCATION_TIMING_MS.FRESH_FIX) return;

        useGeolocationStore.getState().actions.requestFocus(null);
        focusOnUser(map, userLocation, accuracyM, cities, coverages, focusRequest, focusRequestedAt);
    }, [focusRequest, focusRequestedAt, userLocation, accuracyM, lastUpdatedAt, mapLoaded, mapRef, cities, coverages]);
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
    if (hasGeolocation()) requestFocus('welcome');
};
