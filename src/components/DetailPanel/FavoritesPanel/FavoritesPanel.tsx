import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { usePreferencesStore } from '../../../state/preferencesStore';
import { useStops } from '../../../hooks/data/useStops';
import { FavoritesStopCard } from './FavoritesStopCard';
import { FavoritesStopCardSkeleton } from './FavoritesStopCardSkeleton';
import { Star } from 'lucide-react';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '../../ui/empty';
import { apiFetch } from '../../../lib/api-client';
import { TRANSIT_REFRESH_MS } from '../../../config/constants';
import type { StopFeature } from '../../../types/stops';
import type { DeparturesResponse } from '../../../hooks/data/useDepartures';
import type { AppError } from '../../../types/error';
import type { Departure } from '../../../types/transit';

interface FavoritesPanelProps {
    onClose?: () => void;
}

export const FavoritesPanel: React.FC<FavoritesPanelProps> = ({ onClose }) => {
    const { t } = useTranslation();

    // Preferences
    const favoriteStops = usePreferencesStore(s => s.favoriteStops);

    const { isLoading: stopsLoading, allFeatures: stopsData } = useStops();

    // Map favoriteStops (IDs) to StopFeature features efficiently using a Map
    const favoriteStopFeatures = useMemo(() => {
        if (!stopsData?.features || favoriteStops.length === 0) return [];

        const stopLookup = new Map<string, StopFeature>();
        for (const feature of stopsData.features) {
            stopLookup.set(feature.properties.stop_id, feature);
            if (feature.properties.all_ids) {
                for (const subId of feature.properties.all_ids) {
                    stopLookup.set(subId, feature);
                }
            }
        }

        return favoriteStops
            .map(id => stopLookup.get(id))
            .filter((f): f is StopFeature => f !== undefined);
    }, [stopsData, favoriteStops]);

    // Extract all stop_ids for departures bulk fetching
    const stopIds = useMemo(() => {
        return favoriteStopFeatures.map(f => f.properties.stop_id);
    }, [favoriteStopFeatures]);

    const selectedCity = usePreferencesStore(s => s.selectedCity);

    // Fetch all departures in a single bulk API request
    const { data, isLoading: departuresLoading, isError } = useQuery<DeparturesResponse | null, AppError>({
        queryKey: ['departures', 'bulk', selectedCity, stopIds.join(',')],
        queryFn: async () => {
            if (stopIds.length === 0 || !selectedCity) return null;
            const params = new URLSearchParams();
            stopIds.forEach(id => params.append('stopId', id));
            return apiFetch<DeparturesResponse>(`/${selectedCity}/departures?${params.toString()}`);
        },
        refetchInterval: TRANSIT_REFRESH_MS,
        staleTime: TRANSIT_REFRESH_MS,
        placeholderData: keepPreviousData,
        enabled: stopIds.length > 0
    });

    // Group departures by stopId for fast O(1) lookup
    const departuresByStop = useMemo(() => {
        const map = new Map<string, Departure[]>();
        if (!data?.departures) return map;

        data.departures.forEach(dep => {
            if (dep.stopId) {
                if (!map.has(dep.stopId)) {
                    map.set(dep.stopId, []);
                }
                map.get(dep.stopId)!.push(dep);
            }
        });
        return map;
    }, [data]);

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
            <Empty className="py-16 border-none animate-in fade-in duration-500">
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
                    <EmptyDescription className="text-[13px] max-w-[220px]">
                        {t('favorites.emptySub')}
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <div className="flex flex-col gap-3 pt-2">
            <AnimatePresence mode="popLayout" initial={false}>
                {favoriteStopFeatures.map((feature) => {
                    const stopId = feature.properties.stop_id;
                    const stopDepartures = departuresByStop.get(stopId) || [];
                    return (
                        <motion.div
                            key={stopId}
                            layout
                            initial={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, scale: 0.95, height: 0, overflow: 'hidden' }}
                            transition={{ duration: 0.2 }}
                        >
                            <FavoritesStopCard 
                                stopFeature={feature} 
                                departures={stopDepartures}
                                isLoading={departuresLoading}
                                isError={isError}
                                onClosePanel={onClose} 
                            />
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
};

FavoritesPanel.displayName = 'FavoritesPanel';
