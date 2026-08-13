import { FRONTEND_CITIES_CONFIG, FALLBACK_CITY_CONFIG } from '../config/cities';
import { useGeolocationStore } from '../state/geolocationStore';

/**
 * Calculates the initial map view state based on URL parameters or stored user location.
 * Falls back to default city configuration if no other data is available.
 *
 * @returns Object containing initial latitude, longitude, and zoom
 */
export const getInitialViewState = () => {
    const p = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');

    // Extract city from pathname (e.g. /brno) to use as default center
    let defaultCity = FALLBACK_CITY_CONFIG;
    if (typeof window !== 'undefined') {
        const pathParts = window.location.pathname.split('/');
        const possibleCitySlug = pathParts[1];
        
        if (FRONTEND_CITIES_CONFIG[possibleCitySlug]) {
            defaultCity = FRONTEND_CITIES_CONFIG[possibleCitySlug];
        }
    }

    // Default values
    let lat = defaultCity.center[1];
    let lng = defaultCity.center[0];
    let z = 12; // default overview zoom
    const userZoom = 16; // default zoom for user locations

    // Try to get from persisted geolocation store if no URL params are present
    if (typeof window !== 'undefined' && !p.has('lat') && !p.has('lng')) {
        const savedLocation = useGeolocationStore.getState().lastLocation;
        if (savedLocation && typeof savedLocation.lat === 'number' && typeof savedLocation.lng === 'number') {
            const { lat: sLat, lng: sLng } = savedLocation;
            // Check if saved location belongs to the requested city.
            // If we navigate to /brno but saved location is Prague, ignore it!
            const [minLng, minLat, maxLng, maxLat] = defaultCity.bounds;
            const isInsideCity = (sLng >= minLng && sLng <= maxLng && sLat >= minLat && sLat <= maxLat);
            
            if (isInsideCity) {
                lat = sLat;
                lng = sLng;
                z = userZoom;
            }
        }
    }

    return {
        latitude: parseFloat(p.get('lat') || lat.toString()),
        longitude: parseFloat(p.get('lng') || lng.toString()),
        zoom: parseFloat(p.get('z') || z.toString())
    };
};


