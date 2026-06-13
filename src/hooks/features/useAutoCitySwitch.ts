import { useEffect } from 'react';
import { useCities } from '../data/useCities';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useMapMetadataStore } from '../../state/mapMetadataStore';

/**
 * useAutoCitySwitch
 * 
 * 1. Automatically switches the active city in preferencesStore if the map's viewport 
 *    center moves inside another city's bounding box.
 * 2. Automatically flies the map to the selected city's center if the selectedCity 
 *    changes (e.g. via URL) and the map is currently outside its bounds.
 */
export const useAutoCitySwitch = () => {
    const { data } = useCities();
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    
    const mapRef = useMapMetadataStore(s => s.mapRef);
    const mapLoaded = useMapMetadataStore(s => s.mapLoaded);

    useEffect(() => {
        if (!mapLoaded || !mapRef.current || !data?.cities) {
            return;
        }

        const map = mapRef.current.getMap();

        const handleMoveEnd = () => {
            const center = map.getCenter();
            
            const newCity = data.cities.find(city => {
                const [minLng, minLat, maxLng, maxLat] = city.bounds;
                return (
                    center.lng >= minLng &&
                    center.lng <= maxLng &&
                    center.lat >= minLat &&
                    center.lat <= maxLat
                );
            });

            // If we found a city and it's different from the currently selected one, switch to it
            // State mutation uses zustand's getState to avoid missing state updates if closure goes stale,
            // though we have selectedCity in dependency array.
            const currentSelectedCity = usePreferencesStore.getState().selectedCity;
            if (newCity && newCity.slug !== currentSelectedCity) {
                // Change state immediately
                usePreferencesStore.getState().actions.setSelectedCity(newCity.slug);
                
                // Also update the URL so useRouteParams doesn't revert it
                // Preserve the search params (lat, lng, z) that useMapEvents manages
                const newUrl = `/${newCity.slug}${window.location.search}`;
                
                // Use history.replaceState to avoid adding navigation history for panning
                window.history.replaceState({}, '', newUrl);
                
                // Dispatch a popstate event so wouter knows the URL changed
                window.dispatchEvent(new Event('popstate'));
            }
        };

        map.on('moveend', handleMoveEnd);

        return () => {
            map.off('moveend', handleMoveEnd);
        };
    }, [mapLoaded, mapRef, data]);

    // 2. State -> Map sync (fly to new city if selectedCity changes via URL)
    useEffect(() => {
        if (!mapLoaded || !mapRef.current || !data?.cities) {
            return;
        }

        const map = mapRef.current.getMap();
        const cityData = data.cities.find(c => c.slug === selectedCity);
        
        if (!cityData || !cityData.center) {
            return;
        }

        const center = map.getCenter();
        const [minLng, minLat, maxLng, maxLat] = cityData.bounds;
        
        const isInside = (
            center.lng >= minLng &&
            center.lng <= maxLng &&
            center.lat >= minLat &&
            center.lat <= maxLat
        );

        // If selectedCity changed but we are outside its bounds, fly there.
        // This handles cases where user clicks a link to /brno while map is in Prague.
        if (!isInside) {
            map.flyTo({
                center: cityData.center as [number, number],
                zoom: 12,
                duration: 1500
            });
        }
    }, [selectedCity, mapLoaded, mapRef, data]);
};