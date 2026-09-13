import React, { useMemo } from 'react';

import { useTranslation } from 'react-i18next';
import { usePreferencesStore } from '../../../state/preferencesStore';
import { useStops } from '../../../hooks/data/useStops';
import { useFavoriteDepartures } from '../../../hooks/data/useFavoriteDepartures';
import { FavoritesStopCard } from './FavoritesStopCard';
import { FavoritesStopCardSkeleton } from './FavoritesStopCardSkeleton';
import { Star } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '../../ui/empty';
import type { StopFeature } from '../../../types/stops';

export const FavoritesPanel: React.FC = () => {
    const { t } = useTranslation();

    // Preferences
    const favoriteStops = usePreferencesStore(s => s.favoriteStops);

    const { isLoading: stopsLoading, stopIndex } = useStops();

    const favoriteStopFeatures = useMemo(() => {
        if (!stopIndex || favoriteStops.length === 0) return [];

        return favoriteStops
            .map(id => stopIndex.get(id))
            .filter((f): f is StopFeature => f !== undefined);
    }, [stopIndex, favoriteStops]);

    // Extract all stop_ids for departures bulk fetching
    const stopIds = useMemo(() => {
        return favoriteStopFeatures.map(f => f.properties.stop_id);
    }, [favoriteStopFeatures]);

    const { departuresByStop, isLoading: departuresLoading, isError } = useFavoriteDepartures(stopIds);

    const isLoading = stopsLoading || (departuresLoading && favoriteStops.length > 0);

    if (isLoading && favoriteStops.length > 0) {
        return (
            <div className="flex flex-col gap-3 pt-2">
                {Array.from({ length: favoriteStops.length }).map((_, idx) => (
                    <FavoritesStopCardSkeleton key={idx} />
                ))}
            </div>
        );
    }

    if (favoriteStopFeatures.length === 0) {
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

FavoritesPanel.displayName = 'FavoritesPanel';
