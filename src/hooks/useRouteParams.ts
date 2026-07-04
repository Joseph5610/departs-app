import { useRoute, useLocation } from 'wouter';
import { usePreferencesStore } from '../state/preferencesStore';
import { useEffect } from 'react';
import { useCities } from './data/useCities';
import { FALLBACK_CITY_CONFIG, FRONTEND_CITIES_CONFIG } from '../config/cities';

/**
 * Hook to parse and validate transit-related routing parameters from the URL.
 * Handles synchronizing the URL city parameter (e.g. /prague, /brno) with the
 * global `preferencesStore`.
 * 
 * To prevent viewport race conditions:
 * 1. **Immediate Sync (Synchronous)**: On mount, if the URL contains a statically
 *    known city, we update the store immediately. This ensures hooks like `useAutoCitySwitch`
 *    which run on map load see the correct city without waiting for API responses.
 * 2. **Dynamic Validation (Asynchronous)**: Once the backend cities list loads,
 *    we run full validation to handle edge cases, invalid pathnames, and canonical SEO redirects.
 * 
 * @returns Parsed route parameters: { city, stopId, tripId, vehicleId }
 */
export const useRouteParams = () => {
    const [isStop, stopParams] = useRoute('/:city/stop/:stopId');
    const [isTrip, tripParams] = useRoute('/:city/trip/:tripId');
    const [isTripVehicle, tripVehicleParams] = useRoute('/:city/trip/:tripId/:vehicleId');
    const [isCityBase, cityBaseParams] = useRoute('/:city');

    let city = null;
    let stopId = null;
    let tripId = null;
    let vehicleId = null;

    if (isTripVehicle) {
        city = decodeURIComponent(tripVehicleParams.city);
        tripId = decodeURIComponent(tripVehicleParams.tripId);
        vehicleId = decodeURIComponent(tripVehicleParams.vehicleId);
    } else if (isTrip) {
        city = decodeURIComponent(tripParams.city);
        tripId = decodeURIComponent(tripParams.tripId);
    } else if (isStop) {
        city = decodeURIComponent(stopParams.city);
        stopId = decodeURIComponent(stopParams.stopId);
    } else if (isCityBase) {
        city = decodeURIComponent(cityBaseParams.city);
    }

    const { data: citiesData } = useCities();
    const setSelectedCity = usePreferencesStore(s => s.actions.setSelectedCity);
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const [, navigate] = useLocation();

    // Sync static city configuration to store immediately on mount to prevent map fly-to race conditions
    useEffect(() => {
        if (city && FRONTEND_CITIES_CONFIG[city] && selectedCity !== city) {
            setSelectedCity(city);
        }
    }, [city, selectedCity, setSelectedCity]);

    useEffect(() => {
        if (!citiesData?.cities.length) return;

        const validCities = new Set(citiesData.cities.map(c => c.slug));
        const defaultCity = citiesData.cities[0]?.slug || FALLBACK_CITY_CONFIG.slug;
        const safeCity = validCities.has(selectedCity) ? selectedCity : defaultCity;

        // 1. Fix persisted store if it holds an invalid city
        if (safeCity !== selectedCity) {
            setSelectedCity(safeCity);
        }

        // 2. Handle URL city validation
        if (!city) return;

        if (city === defaultCity && isCityBase) {
            if (window.location.pathname !== '/') {
                navigate('/', { replace: true });
            }
            return;
        }

        if (validCities.has(city)) {
            // Valid city in URL: sync store if needed
            if (city !== safeCity) setSelectedCity(city);
        } else {
            // Invalid city in URL: redirect to safe city
            const redirectPath = safeCity === defaultCity ? '/' : `/${safeCity}`;
            navigate(redirectPath, { replace: true });
        }
    }, [city, selectedCity, setSelectedCity, citiesData, navigate, isCityBase]);

    return { city, stopId, tripId, vehicleId };
};
