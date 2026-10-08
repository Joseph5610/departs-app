import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Reorder } from 'framer-motion';
import { Star } from 'lucide-react';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useFavorites } from '@/hooks/derived/useFavorites';
import { useFavoriteDepartures } from '@/hooks/data/useFavoriteDepartures';
import { moveShown } from '@/domain/departures';
import { FavoritesStopCard } from './FavoritesStopCard';
import { FavoriteLineCard } from './FavoriteLineCard';
import { FavoritesStopCardSkeleton } from './FavoritesStopCardSkeleton';
import { SortableFavorite } from './SortableFavorite';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import type { FavoriteLine, PinnedStop } from '@/types';

export const FavoritesPanel = () => {
    const { t } = useTranslation();

    const { allLines: favoriteLines, allStops: favoriteStops, lines, stops, stopIndex, isLoading: stopsLoading, pinnedStopCount, hasTabs } = useFavorites();
    const { reorderFavoriteLines, reorderFavoriteStops } = usePreferencesStore(s => s.actions);

    const stopIds = useMemo(() => {
        const ids = new Set(favoriteStops.map(pin => pin.feature.properties.stop_id));
        for (const fav of favoriteLines) ids.add(fav.stopId);
        return [...ids];
    }, [favoriteStops, favoriteLines]);

    const { departuresByStop, isLoading: departuresLoading, isError } = useFavoriteDepartures(stopIds);

    const reorderStops = useCallback(
        (pins: PinnedStop[]) => reorderFavoriteStops(pins.map(pin => pin.id)),
        [reorderFavoriteStops]
    );
    const moveLine = useCallback(
        (fav: FavoriteLine, delta: number) => reorderFavoriteLines([...moveShown(favoriteLines, fav, delta)]),
        [favoriteLines, reorderFavoriteLines]
    );
    const moveStop = useCallback(
        (pin: PinnedStop, delta: number) => reorderStops([...moveShown(favoriteStops, pin, delta)]),
        [favoriteStops, reorderStops]
    );

    const hasFavorites = pinnedStopCount > 0 || favoriteLines.length > 0;

    if ((stopsLoading || departuresLoading) && hasFavorites) {
        return (
            <div className="flex flex-col gap-3 pt-2">
                {Array.from({ length: hasTabs ? lines.length + stops.length : pinnedStopCount + favoriteLines.length }).map((_, idx) => (
                    <FavoritesStopCardSkeleton key={idx} />
                ))}
            </div>
        );
    }

    if (favoriteStops.length === 0 && favoriteLines.length === 0) {
        return (
            <Empty className="py-16 animate-in fade-in duration-500">
                <EmptyHeader>
                    <EmptyMedia
                        variant="icon"
                        className="size-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary shadow-[0_0_20px_rgba(var(--color-primary),0.1)] [&_svg:not([class*='size-'])]:size-7"
                    >
                        <Star strokeWidth={1.5} />
                    </EmptyMedia>
                    <EmptyTitle className="text-base font-bold text-foreground/90">
                        {t('favorites.empty')}
                    </EmptyTitle>
                    <EmptyDescription className="text-[13px] max-w-55">
                        {t('favorites.emptySub')}
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <div className="flex flex-col gap-3 pt-2">
            {lines.length > 0 && (
                <Reorder.Group as="div" axis="y" values={lines} onReorder={reorderFavoriteLines} className="flex flex-col gap-3">
                    {lines.map((fav) => (
                        <SortableFavorite key={`${fav.stopId}|${fav.line}|${fav.headsign}`} value={fav} sortable={lines.length > 1} onMove={moveLine}>
                            {(handle) => (
                                <FavoriteLineCard
                                    favorite={fav}
                                    stopFeature={stopIndex.get(fav.stopId)}
                                    departures={departuresByStop.get(fav.stopId) ?? []}
                                    isLoading={departuresLoading}
                                    dragHandle={handle}
                                />
                            )}
                        </SortableFavorite>
                    ))}
                </Reorder.Group>
            )}
            {stops.length > 0 && (
                <Reorder.Group as="div" axis="y" values={stops} onReorder={reorderStops} className="flex flex-col gap-3">
                    {stops.map((pin) => (
                        <SortableFavorite key={pin.id} value={pin} sortable={stops.length > 1} onMove={moveStop}>
                            {(handle) => (
                                <FavoritesStopCard
                                    pinnedIds={pin.ids}
                                    stopFeature={pin.feature}
                                    departures={departuresByStop.get(pin.feature.properties.stop_id) ?? []}
                                    isLoading={departuresLoading}
                                    isError={isError}
                                    dragHandle={handle}
                                />
                            )}
                        </SortableFavorite>
                    ))}
                </Reorder.Group>
            )}
        </div>
    );
};
