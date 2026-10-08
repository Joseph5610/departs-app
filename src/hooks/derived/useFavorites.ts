import { usePreferencesStore } from '@/state/preferencesStore';
import { useStops } from '@/hooks/data/useStops';
import { pinnedStops } from '@/domain/stops';
import { favoriteLinesIn, favoritesView } from '@/domain/departures';
import { memoizeLast } from '@/lib/memoize';

const linesIn = memoizeLast(favoriteLinesIn);
const stopsPinned = memoizeLast(pinnedStops);
const viewOf = memoizeLast(favoritesView<ReturnType<typeof pinnedStops>[number]>);

/**
 * The selected city's pinned lines and the pinned stops its stop list knows (`all*`), and what the panel
 * lists of them: with both kinds pinned it shows tabs and only the open tab's pins.
 */
export const useFavorites = () => {
    const favoriteStops = usePreferencesStore(s => s.favoriteStops);
    const favoriteLines = usePreferencesStore(s => s.favoriteLines);
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const tab = usePreferencesStore(s => s.favoritesTab);
    const { isLoading, stopIndex } = useStops();

    const allLines = linesIn(favoriteLines, selectedCity);
    const allStops = stopsPinned(stopIndex, favoriteStops);

    return { allLines, allStops, ...viewOf(allLines, allStops, tab), tab, stopIndex, isLoading, pinnedStopCount: favoriteStops.length };
};
