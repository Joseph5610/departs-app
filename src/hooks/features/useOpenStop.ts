import { useCallback } from 'react';
import { usePreferencesStore } from '@/state/preferencesStore';
import { navigate } from '@/lib/history';
import { paths } from '@/lib/routes';

/** Opens a stop's board in the selected city. */
export const useOpenStop = () => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    return useCallback((stopId: string) => navigate(paths.stop(selectedCity, stopId)), [selectedCity]);
};
