import { usePreferencesStore } from '@/state/preferencesStore';
import { useStops } from '@/hooks/data/useStops';
import { boardsOf, favoriteStopsIn, pinnedStops } from '@/domain/stops';
import type { FavoriteLine, StopModel } from '@/types';
import { favoriteLinesIn, favoritesView } from '@/domain/departures';
import { memoizeLast } from '@/lib/memoize';

const linesIn = memoizeLast(favoriteLinesIn);
const stopsPinned = memoizeLast(pinnedStops);
const pinsIn = memoizeLast(favoriteStopsIn);
const lineStopsOf = memoizeLast((model: StopModel | null, lines: readonly FavoriteLine[]) => boardsOf(model, lines.map(fav => fav.stopId)));
const viewOf = memoizeLast(favoritesView<ReturnType<typeof pinnedStops>[number]>);

/**
 * The selected city's pinned lines and the pinned stops its stop list knows (`all*`), and what the panel
 * lists of them: with both kinds pinned it shows tabs and only the open tab's pins. `lineStops` holds each pinned line's stop.
 */
export const useFavorites = () => {
    const favoriteStops = usePreferencesStore(s => s.favoriteStops);
    const favoriteLines = usePreferencesStore(s => s.favoriteLines);
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const tab = usePreferencesStore(s => s.favoritesTab);
    const { isLoading, model } = useStops();

    const allLines = linesIn(favoriteLines, selectedCity);
    const cityPins = pinsIn(favoriteStops, selectedCity);
    const allStops = stopsPinned(model, cityPins);

    const lineStops = lineStopsOf(model, allLines);

    return { allLines, allStops, ...viewOf(allLines, allStops, tab), tab, lineStops, isLoading, cityPins, pinnedStopCount: cityPins.length };
};
