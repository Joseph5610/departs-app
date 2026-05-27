
import { useEffect } from 'react';
import { STORAGE_KEYS, MAP_VEHICLE_SELECT_ZOOM } from '../../config/constants';
import { useGeolocationStore } from '../../state/geolocationStore';
import { useMapMetadataStore } from '../../state/mapMetadataStore';

/**
 * useGeolocation
 *
 * Headless hook that manages the geolocation lifecycle.
 * It auto-starts the watcher and handles initial map focus.
 */
export const useGeolocation = () => {
    const watchId = useGeolocationStore(s => s.watchId);
    const userLocation = useGeolocationStore(s => s.userLocation);
    const { performGeolocation, setWatchId } = useGeolocationStore(s => s.actions);

    const mapLoaded = useMapMetadataStore(s => s.mapLoaded);
    const mapRef = useMapMetadataStore(s => s.mapRef);

    // Auto-start watcher on mount (only if welcome modal was already seen or skipped)
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

    // Initial map focus once both map and location are ready
    useEffect(() => {
        if (mapLoaded && userLocation && mapRef.current) {
            const map = mapRef.current.getMap();
            const p = new URLSearchParams(window.location.search);
            const hasExplicitLocation = p.has('lat') || p.has('lng') || p.has('stopId') || p.has('tripId');

            // We use a simple session-based flag to ensure we only auto-focus once per session
            if (!hasExplicitLocation && !sessionStorage.getItem('initial_geo_focus')) {
                map.jumpTo({ center: userLocation, zoom: MAP_VEHICLE_SELECT_ZOOM });
                sessionStorage.setItem('initial_geo_focus', 'true');
            }
        }
    }, [mapLoaded, userLocation, mapRef]);
};
