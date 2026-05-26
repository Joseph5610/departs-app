import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { usePreferencesStore } from '../../../state/preferencesStore';
import { useStops } from '../../../hooks/data/useStops';
import { FavoritesStopCard } from './FavoritesStopCard';
import { FavoritesStopCardSkeleton } from './FavoritesStopCardSkeleton';
import { Star } from 'lucide-react';
import { Stack } from '@/components/ui/layout';
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

    // Fetch all departures in a single bulk API request
    const { data, isLoading: departuresLoading, isError } = useQuery<DeparturesResponse | null, AppError>({
        queryKey: ['departures', 'bulk', stopIds.join(',')],
        queryFn: async () => {
            if (stopIds.length === 0) return null;
            const params = new URLSearchParams();
            stopIds.forEach(id => params.append('stopId', id));
            return apiFetch<DeparturesResponse>(`/api/departures?${params.toString()}`);
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
            <Stack gap={3} className="pt-2">
                {Array.from({ length: favoriteStops.length }).map((_, idx) => (
                    <FavoritesStopCardSkeleton key={idx} />
                ))}
            </Stack>
        );
    }

    if (favoriteStopFeatures.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center text-center py-16 px-4">
                <div className="relative mb-6">
                    {/* Glowing backdrop circle */}
                    <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl transform scale-150" />
                    <div className="relative w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground/30 shadow-inner">
                        <Star size={24} className="text-muted-foreground/40 stroke-[1.5]"  strokeWidth={1.5} />
                    </div>
                </div>
                <h3 className="text-base font-bold text-foreground mb-1.5">
                    {t('favorites.empty')}
                </h3>
                <p className="text-[12.5px] text-muted-foreground/60 leading-relaxed max-w-[240px]">
                    {t('favorites.emptySub')}
                </p>
            </div>
        );
    }

    return (
        <Stack gap={3} className="pt-2">
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
        </Stack>
    );
};

FavoritesPanel.displayName = 'FavoritesPanel';
