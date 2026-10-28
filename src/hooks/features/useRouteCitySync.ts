import { useEffect } from 'react';
import { navigate } from '@/lib/history';
import { useRouteParams } from '@/hooks/useRouteParams';
import { getUrlUnlockedCity, usePreferencesStore } from '@/state/preferencesStore';
import { DEFAULT_CITY_SLUG, FRONTEND_CITIES_CONFIG } from '@/config/cities';
import { paths } from '@/lib/routes';

/**
 * Keeps the selected city in step with the URL. Mount exactly once (MapController).
 *
 * 1. A URL city the bundle knows is written to the store, so hooks that run on map load
 *    (e.g. `useAutoCitySwitch`) see it.
 * 2. Invalid persisted or URL cities are corrected and the default city's base path is redirected to `/`.
 * 3. `?beta=<slug>` unlocks a hidden region for this device.
 */
export const useRouteCitySync = () => {
    const { city, isCityBase } = useRouteParams();
    const setSelectedCity = usePreferencesStore(s => s.actions.setSelectedCity);
    const unlockCity = usePreferencesStore(s => s.actions.unlockCity);
    const selectedCity = usePreferencesStore(s => s.selectedCity);

    // `?beta=<slug>` in the URL keeps a hidden region in this device's city list from now on.
    useEffect(() => {
        const unlocked = getUrlUnlockedCity();
        if (unlocked) unlockCity(unlocked);
    }, [unlockCity]);

    useEffect(() => {
        const isValid = (slug: string) => Object.hasOwn(FRONTEND_CITIES_CONFIG, slug);
        const safeCity = isValid(selectedCity) ? selectedCity : DEFAULT_CITY_SLUG;

        if (city === DEFAULT_CITY_SLUG && isCityBase) {
            if (selectedCity !== city) setSelectedCity(city);
            if (window.location.pathname !== '/') navigate('/', { replace: true });
            return;
        }

        if (city && isValid(city)) {
            if (city !== selectedCity) setSelectedCity(city);
            return;
        }

        if (safeCity !== selectedCity) setSelectedCity(safeCity);
        if (city) navigate(safeCity === DEFAULT_CITY_SLUG ? '/' : paths.city(safeCity), { replace: true });
    }, [city, selectedCity, setSelectedCity, isCityBase]);
};
