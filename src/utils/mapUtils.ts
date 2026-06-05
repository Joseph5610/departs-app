import { FALLBACK_CITY_CONFIG, STORAGE_KEYS } from '../config/constants';

/**
 * Calculates the initial map view state based on URL parameters or stored user location.
 * Falls back to default city configuration if no other data is available.
 *
 * @returns Object containing initial latitude, longitude, and zoom
 */
export const getInitialViewState = () => {
    const p = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');

    // Default values
    let lat = FALLBACK_CITY_CONFIG.center.lat;
    let lng = FALLBACK_CITY_CONFIG.center.lng;
    let z = FALLBACK_CITY_CONFIG.zoom;

    // Try to get from localStorage if no URL params are present
    if (typeof window !== 'undefined' && !p.has('lat') && !p.has('lng')) {
        const saved = localStorage.getItem(STORAGE_KEYS.LAST_LOCATION);
        if (saved) {
            try {
                const { lat: sLat, lng: sLng } = JSON.parse(saved);
                if (typeof sLat === 'number' && typeof sLng === 'number') {
                    lat = sLat;
                    lng = sLng;
                    z = FALLBACK_CITY_CONFIG.userZoom;
                }
            } catch (e) {
                console.error('Failed to parse lastUserLocation', e);
            }
        }
    }

    return {
        latitude: parseFloat(p.get('lat') || lat.toString()),
        longitude: parseFloat(p.get('lng') || lng.toString()),
        zoom: parseFloat(p.get('z') || z.toString())
    };
};


