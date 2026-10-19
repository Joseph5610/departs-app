import { useEffect } from 'react';
import { navigate } from '@/lib/history';
import { paths } from '@/lib/routes';
import { useRouteParams } from '@/hooks/useRouteParams';
import { useSelectedStop } from '@/hooks/derived/useSelectedStop';
import { usePreferencesStore } from '@/state/preferencesStore';

/**
 * Rewrites a stop URL naming its stop by another id (an alias, a pre-stops.json PID id) to the stop's own,
 * so links, favourites and the departures cache all key on one id. Mount exactly once (MapController).
 */
export const useCanonicalStopUrl = () => {
    const { city } = useRouteParams();
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const stop = useSelectedStop();
    const canonicalId = stop?.board?.id;

    useEffect(() => {
        if (!stop || !canonicalId || canonicalId === stop.id || city !== selectedCity) return;
        navigate(`${paths.stop(selectedCity, canonicalId)}${window.location.search}`, { replace: true });
    }, [stop, canonicalId, city, selectedCity]);
};
