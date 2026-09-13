import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Building2 } from 'lucide-react';
import React from 'react';
import { useCities, useCityConfig } from '../data/useCities';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useMapMetadataStore } from '../../state/mapMetadataStore';
import { navigate } from 'wouter/use-browser-location';
import { cityOverviewCamera } from '../../utils/mapUtils';

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
    const cityConfig = useCityConfig();
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const hasSeenWelcome = usePreferencesStore(s => s.hasSeenWelcome);
    
    const mapRef = useMapMetadataStore(s => s.mapRef);
    const mapLoaded = useMapMetadataStore(s => s.mapLoaded);

    const prevCity = React.useRef(selectedCity);
    const initialWelcomeSeen = React.useRef(hasSeenWelcome);
    const isFirstChange = React.useRef(true);

    useEffect(() => {
        if (prevCity.current !== selectedCity) {
            const wasFirstChange = isFirstChange.current;
            isFirstChange.current = false;
            
            const initiallyNotSeen = !initialWelcomeSeen.current;
            
            // Skip toast if this is the very first city change for a new user
            if (!(initiallyNotSeen && wasFirstChange)) {
                if (cityConfig.name) {
                    toast(t('map.controls.switchedCity', { city: cityConfig.name }), {
                        icon: React.createElement(Building2, { className: "w-4 h-4 text-primary" })
                    });
                }
            }
            prevCity.current = selectedCity;
        }
    }, [selectedCity, cityConfig.name, t]);

    useEffect(() => {
        if (!mapLoaded || !mapRef.current || !data?.cities) {
            return;
        }

        const map = mapRef.current.getMap();

        const handleMoveEnd = (e: { originalEvent?: Event }) => {
            if (!e.originalEvent) {
                return;
            }
            
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

                // Replace rather than push, so panning doesn't add history entries
                navigate(newUrl, { replace: true });
            }
        };

        map.on('moveend', handleMoveEnd);

        return () => {
            map.off('moveend', handleMoveEnd);
        };
    }, [mapLoaded, mapRef, data, t]);

    // 2. State -> Map sync (fly to new city if selectedCity changes via URL)
    useEffect(() => {
        if (!mapLoaded || !mapRef.current) {
            return;
        }

        const map = mapRef.current.getMap();
        const center = map.getCenter();
        const [minLng, minLat, maxLng, maxLat] = cityConfig.bounds;
        
        const isInsideStrict = (
            center.lng >= minLng &&
            center.lng <= maxLng &&
            center.lat >= minLat &&
            center.lat <= maxLat
        );

        const isCenterVisible = map.getBounds().contains(cityConfig.center);

        // If selectedCity changed but we are outside its bounds and its center is not visible, fly there.
        // This handles cases where user clicks a link to /brno while map is in Prague.
        // If the center is already visible, the user probably just panned there, so don't aggressively fly.
        if (!isInsideStrict && !isCenterVisible) {
            map.flyTo(cityOverviewCamera(cityConfig.center));
        }
    }, [cityConfig.center, cityConfig.bounds, mapLoaded, mapRef]);
};