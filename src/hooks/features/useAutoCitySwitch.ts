import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Building2 } from 'lucide-react';
import React from 'react';
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
    const { t } = useTranslation();
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
            
            let newCity = data.cities.find(city => {
                const [minLng, minLat, maxLng, maxLat] = city.bounds;
                return (
                    center.lng >= minLng &&
                    center.lng <= maxLng &&
                    center.lat >= minLat &&
                    center.lat <= maxLat
                );
            });

            // If the map center is not strictly inside any city's bounding box,
            // try to find a city whose center point is visible on the screen
            if (!newCity) {
                const bounds = map.getBounds();
                const visibleCities = data.cities.filter(city => {
                    if (!city.center) return false;
                    const [lng, lat] = city.center as [number, number];
                    // check if the city center is within the viewport
                    return bounds.contains([lng, lat]);
                });

                if (visibleCities.length > 0) {
                    let minDistance = Infinity;
                    for (const city of visibleCities) {
                        const [lng, lat] = city.center as [number, number];
                        const dist = Math.pow(lng - center.lng, 2) + Math.pow(lat - center.lat, 2);
                        if (dist < minDistance) {
                            minDistance = dist;
                            newCity = city;
                        }
                    }
                }
            }

            // If we found a city and it's different from the currently selected one, switch to it
            // State mutation uses zustand's getState to avoid missing state updates if closure goes stale,
            // though we have selectedCity in dependency array.
            const currentSelectedCity = usePreferencesStore.getState().selectedCity;
            if (newCity && newCity.slug !== currentSelectedCity) {
                // Change state immediately
                usePreferencesStore.getState().actions.setSelectedCity(newCity.slug);
                
                // Trigger toast notification
                toast(t('map.controls.switchedCity', { city: newCity.name }), {
                    icon: React.createElement(Building2, { className: "w-4 h-4 text-primary" })
                });
                
                // Also update the URL so useRouteParams doesn't revert it
                // Preserve the rest of the path (like /stop/123) and search params (lat, lng, z)
                const currentPath = window.location.pathname;
                const pathParts = currentPath.split('/').filter(Boolean);
                if (pathParts.length > 0) {
                    pathParts[0] = newCity.slug;
                } else {
                    pathParts.push(newCity.slug);
                }
                const newUrl = `/${pathParts.join('/')}${window.location.search}`;
                
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
    }, [mapLoaded, mapRef, data, t]);

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
        
        const isInsideStrict = (
            center.lng >= minLng &&
            center.lng <= maxLng &&
            center.lat >= minLat &&
            center.lat <= maxLat
        );

        const isCenterVisible = map.getBounds().contains(cityData.center as [number, number]);

        // If selectedCity changed but we are outside its bounds and its center is not visible, fly there.
        // This handles cases where user clicks a link to /brno while map is in Prague.
        // If the center is already visible, the user probably just panned there, so don't aggressively fly.
        if (!isInsideStrict && !isCenterVisible) {
            map.flyTo({
                center: cityData.center as [number, number],
                zoom: 12,
                duration: 1500
            });
        }
    }, [selectedCity, mapLoaded, mapRef, data]);
};