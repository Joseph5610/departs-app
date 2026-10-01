import { useMemo } from 'react';
import { useVisibleCities } from '../data/useCities';
import { useNetworkCoverage } from '../data/useNetworkCoverage';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useViewportStore } from '../../state/viewportStore';
import { stopsInBox } from '../../utils/mapUtils';

const NONE: readonly string[] = [];

/**
 * useNetworksInView
 *
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
        if (!bounds) return '';
        const [south, west, north, east] = bounds.split(',').map(Number);
        return cities
            .filter(city => {
                const coverage = coverages.get(city.slug);
                return city.slug !== selectedCity && !!coverage && stopsInBox(coverage, [west, south, east, north]) > 0;
            })
            .map(city => city.slug)
            .join(',');
    }, [cities, coverages, selectedCity, bounds]);

    return useMemo(() => (key ? key.split(',') : NONE), [key]);
};
