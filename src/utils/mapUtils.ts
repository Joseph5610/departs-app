import { FALLBACK_CITY_CONFIG, STORAGE_KEYS } from '../config/constants';

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
        
        // We do a simple check. If it matches known slugs or just rely on 'brno' for now
        // A full robust check would need the cities.json, but since it's synchronous we hardcode the known config centers
        if (possibleCitySlug === 'brno') {
            defaultCity = { ...FALLBACK_CITY_CONFIG, slug: 'brno', center: { lat: 49.195060, lng: 16.606837 }, zoom: 12, userZoom: 16 };
        } else if (possibleCitySlug === 'prague') {
            defaultCity = { ...FALLBACK_CITY_CONFIG, slug: 'prague', center: { lat: 50.088040, lng: 14.420760 }, zoom: 12, userZoom: 16 };
        }
    }

    // Default values
    let lat = defaultCity.center.lat;
    let lng = defaultCity.center.lng;
    let z = defaultCity.zoom;

    // Try to get from localStorage if no URL params are present
    if (typeof window !== 'undefined' && !p.has('lat') && !p.has('lng')) {
        const saved = localStorage.getItem(STORAGE_KEYS.LAST_LOCATION);
        if (saved) {
            try {
                const { lat: sLat, lng: sLng } = JSON.parse(saved);
                if (typeof sLat === 'number' && typeof sLng === 'number') {
                    // Check if saved location belongs to the requested city.
                    // If we navigate to /brno but saved location is Prague, ignore it!
                    // Rough bounding box check to prevent /brno -> Prague map load.
                    const isBrno = (sLng > 16.0 && sLng < 17.0 && sLat > 48.8 && sLat < 49.5);
                    const isPrague = (sLng > 14.0 && sLng < 15.0 && sLat > 49.8 && sLat < 50.3);
                    
                    if ((defaultCity.center.lng > 16.0 && isBrno) || (defaultCity.center.lng < 15.0 && isPrague) || (!isBrno && !isPrague)) {
                        lat = sLat;
                        lng = sLng;
                        z = defaultCity.userZoom;
                    }
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


