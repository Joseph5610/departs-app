import { useEffect } from 'react';
import { navigate } from 'wouter/use-browser-location';
import { useRouteParams } from '../useRouteParams';
import { useCities } from '../data/useCities';
import { usePreferencesStore } from '../../state/preferencesStore';
import { FALLBACK_CITY_CONFIG, FRONTEND_CITIES_CONFIG } from '../../config/cities';
import { paths } from '../../lib/routes';

/**
 * Keeps the selected city in step with the URL. Mount exactly once (MapController).
 *
 * 1. A city the bundle knows is written to the store immediately, so hooks that run on map load
 *    (e.g. `useAutoCitySwitch`) see it without waiting for `/api/cities`.
 * 2. Once `/api/cities` loads, invalid persisted or URL cities are corrected and the default city's
 *    base path is redirected to `/`.
 */
export const useRouteCitySync = () => {
    const { city, isCityBase } = useRouteParams();
    const { data: citiesData } = useCities();
    const setSelectedCity = usePreferencesStore(s => s.actions.setSelectedCity);
    const selectedCity = usePreferencesStore(s => s.selectedCity);

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
            const redirectPath = safeCity === defaultCity ? '/' : paths.city(safeCity);
            navigate(redirectPath, { replace: true });
        }
    }, [city, selectedCity, setSelectedCity, citiesData, isCityBase]);
};
