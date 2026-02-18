import { MAP_DEFAULT_COORDS, STORAGE_KEYS } from '../config/constants';

/**
 * Calculates the initial map view state based on URL parameters or stored user location.
 * Falls back to default Prague coordinates if no other data is available.
 *
 * @returns Object containing initial latitude, longitude, and zoom
 */
export const getInitialViewState = () => {
    const p = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');

    // Default values
    let lat = MAP_DEFAULT_COORDS.lat;
    let lng = MAP_DEFAULT_COORDS.lng;
    let z = MAP_DEFAULT_COORDS.zoom;

    // Try to get from localStorage if no URL params are present
    if (typeof window !== 'undefined' && !p.has('lat') && !p.has('lng')) {
        const saved = localStorage.getItem(STORAGE_KEYS.LAST_LOCATION);
        if (saved) {
            try {
                const { lat: sLat, lng: sLng } = JSON.parse(saved);
                if (typeof sLat === 'number' && typeof sLng === 'number') {
                    lat = sLat;
                    lng = sLng;
                    z = MAP_DEFAULT_COORDS.userZoom;
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
