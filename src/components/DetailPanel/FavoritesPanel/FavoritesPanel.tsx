import { useMemo } from 'react';

import { useTranslation } from 'react-i18next';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useStops } from '@/hooks/data/useStops';
import { useFavoriteDepartures } from '@/hooks/data/useFavoriteDepartures';
import { FavoritesStopCard } from './FavoritesStopCard';
import { FavoriteLineCard } from './FavoriteLineCard';
import { FavoritesStopCardSkeleton } from './FavoritesStopCardSkeleton';
import { Star } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { stopsByIds } from '@/domain/stops';

export const FavoritesPanel = () => {
    const { t } = useTranslation();

    const favoriteStops = usePreferencesStore(s => s.favoriteStops);
    const allFavoriteLines = usePreferencesStore(s => s.favoriteLines);

    const { isLoading: stopsLoading, stopIndex } = useStops();

    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const favoriteLines = useMemo(
        () => allFavoriteLines.filter(fav => fav.city === selectedCity),
        [allFavoriteLines, selectedCity]
    );

    const favoriteStopFeatures = useMemo(() => {
        if (!stopIndex || favoriteStops.length === 0) return [];

        return stopsByIds(stopIndex, favoriteStops);
    }, [stopIndex, favoriteStops]);

    const stopIds = useMemo(() => {
        const ids = new Set(favoriteStopFeatures.map(f => f.properties.stop_id));
        for (const fav of favoriteLines) ids.add(fav.stopId);
        return [...ids];
    }, [favoriteStopFeatures, favoriteLines]);

    const { departuresByStop, isLoading: departuresLoading, isError } = useFavoriteDepartures(stopIds);

    const hasFavorites = favoriteStops.length > 0 || favoriteLines.length > 0;
    const isLoading = stopsLoading || (departuresLoading && hasFavorites);

    if (isLoading && hasFavorites) {
        return (
            <div className="flex flex-col gap-3 pt-2">
                {Array.from({ length: favoriteStops.length + favoriteLines.length }).map((_, idx) => (
                    <FavoritesStopCardSkeleton key={idx} />
                ))}
            </div>
        );
    }

    if (favoriteStopFeatures.length === 0 && favoriteLines.length === 0) {
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
            {favoriteLines.length > 0 && favoriteStopFeatures.length > 0 && (
                <span className="micro-label-widest text-muted-foreground px-1">{t('favorites.linesTitle')}</span>
            )}
            {favoriteLines.map((fav) => (
                <div key={`${fav.stopId}|${fav.line}|${fav.headsign}`} className="animate-in fade-in slide-in-from-bottom-1 duration-200">
                    <FavoriteLineCard
                        favorite={fav}
                        stopFeature={stopIndex.get(fav.stopId)}
                        departures={departuresByStop.get(fav.stopId) ?? []}
                        isLoading={departuresLoading}
                    />
                </div>
            ))}
            {favoriteLines.length > 0 && favoriteStopFeatures.length > 0 && (
                <span className="micro-label-widest text-muted-foreground px-1 mt-2">{t('favorites.stopsTitle')}</span>
            )}
            {favoriteStopFeatures.map((feature) => {
                const stopId = feature.properties.stop_id;
                const stopDepartures = departuresByStop.get(stopId) || [];
                return (
                    <div 
                        key={stopId}
                        className="animate-in fade-in slide-in-from-bottom-1 duration-200"
                    >
                        <FavoritesStopCard 
                            stopFeature={feature} 
                            departures={stopDepartures}
                            isLoading={departuresLoading}
                            isError={isError}
                        />
                    </div>
                );
            })}
        </div>
    );
};
