import { useMemo } from 'react';
import { useVisibleCities } from '@/hooks/data/useCities';
import { useNetworkCoverage } from '@/hooks/data/useNetworkCoverage';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useViewportStore } from '@/state/viewportStore';
import { networksInView } from '@/domain/cities';

const NONE: readonly string[] = [];

/**
 * The other networks with stops in the map view (Kladno: DÚK beside PID; Karlovy Vary: PID's long
 * lines), to be shown beside the selected city's. Empty zoomed out too far for vehicles.
 */
export const useNetworksInView = (): readonly string[] => {
    const cities = useVisibleCities();
    const coverages = useNetworkCoverage();
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const bounds = useViewportStore(s => s.debouncedBounds);

    // Keyed by the slugs, so the list keeps its identity while the same networks stay in view.
    const key = useMemo(() => {
        return bounds ? networksInView(cities, coverages, selectedCity, bounds).join(',') : '';
    }, [cities, coverages, selectedCity, bounds]);

    return useMemo(() => (key ? key.split(',') : NONE), [key]);
};
