import React, { useMemo } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import { useVehicles } from '../../../hooks/data/useVehicles';
import { useCityStats } from '../../../hooks/data/useCityStats';
import { usePreferencesStore } from '../../../state/preferencesStore';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';
import { applyEnrichment } from '../../../lib/enrichment';
import { useEnrichmentStore } from '../../../state/enrichmentStore';
import { FRONTEND_CITIES_CONFIG } from '../../../config/cities';
import { aggregateCityStats } from '../../../../functions/_core/utils/statsAggregator';
import type { AppVehicleFeature } from '../../../../functions/_core/types';

import { PunctualityCard } from './cards/PunctualityCard';
import { MovementStateCard } from './cards/MovementStateCard';
import { MostDelayedCard } from './cards/MostDelayedCard';
import { VehicleMixCard } from './cards/VehicleMixCard';
import { BusiestLinesCard } from './cards/BusiestLinesCard';
import { OtherDataCard } from './cards/OtherDataCard';

export const StatsPanel = React.memo(() => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { t } = useTranslation();
    
    const byTripId = useEnrichmentStore(s => s.byTripId);
    const byVehicleId = useEnrichmentStore(s => s.byVehicleId);
    
    const hasEnrichment = !!FRONTEND_CITIES_CONFIG[selectedCity || 'prague']?.enrichmentChannel;
    
    const tab = usePreferencesStore(s => s.statsTab);

    const { vehicles } = useVehicles();
    
    // Compute Screen Stats using the shared aggregator
    const screenStats = useMemo(() => {
        if (!vehicles || !vehicles.features) return null;

        const baseTs = Date.now();

        // 1. Apply enrichment
        const enrichedFeatures = vehicles.features.map(f => {
            const vehicleId = f.properties.vehicle_id || f.properties.vehicle_descriptor?.vehicle_registration_number?.toString() || undefined;
            const p = applyEnrichment(
                f.properties,
                f.properties.gtfs_trip_id,
                vehicleId,
                byTripId,
                byVehicleId,
                baseTs
            ) as typeof f.properties;
            
            return {
                ...f,
                properties: p
            } as typeof f;
        });

        // 2. Aggregate
        return aggregateCityStats(enrichedFeatures as unknown as AppVehicleFeature[]);
    }, [vehicles, byTripId, byVehicleId]);

    const { data: networkStats, isFetching: isNetworkFetching } = useCityStats();
    
    const activeStats = tab === 'screen' ? screenStats : networkStats;
    const isFetching = tab === 'network' && isNetworkFetching && !networkStats;

    return (
        <div className="flex flex-col gap-0 pt-0">
            {isFetching ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground opacity-60">
                    <Activity className="animate-pulse" size={24} />
                    <span className="text-sm font-medium">{t('common.loading')}</span>
                </div>
            ) : activeStats ? (
                <div className="flex flex-col gap-3 pt-2 pb-2">
                    {/* Top Level Totals */}
                    <div className="grid grid-cols-2 gap-3">
                        <Card variant="subtle" size="none">
                            <CardContent className="p-3.5 flex flex-col justify-center h-full">
                                <span className="micro-label text-foreground/60 mb-0.5">{t('stats.vehicles')}</span>
                                <span className="text-2xl font-black tabular-nums tracking-tighter leading-none">{activeStats.total_vehicles}</span>
                            </CardContent>
                        </Card>
                        <Card variant="subtle" size="none">
                            <CardContent className="p-3.5 flex flex-col justify-center h-full">
                                <span className="micro-label text-foreground/60 mb-0.5">{t('stats.lines')}</span>
                                <span className="text-2xl font-black tabular-nums tracking-tighter leading-none">{activeStats.total_lines}</span>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Network Delay Notice */}
                    {hasEnrichment && tab === 'network' && (
                        <Card variant="subtle" size="none" className="bg-amber-500/10 border-amber-500/20 shadow-none">
                            <CardContent className="p-3.5 flex items-start gap-3">
                                <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                                <div className="text-xs text-amber-500/90 leading-relaxed">
                                    {t('stats.networkDelayNotice', 'Live delay and movement data for the entire network is not available in this region. Please switch to the "On Screen" tab to see live data for vehicles currently in view.')}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Delay Dependent Charts */}
                    {!(hasEnrichment && tab === 'network') && (
                        <>
                            <PunctualityCard stats={activeStats} />
                            <MostDelayedCard stats={activeStats} selectedCity={selectedCity || 'prague'} />
                        </>
                    )}

                    <MovementStateCard stats={activeStats} />
                    <VehicleMixCard stats={activeStats} />
                    <BusiestLinesCard stats={activeStats} />
                    <OtherDataCard activeStats={activeStats} networkStats={networkStats} />
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center py-12 text-muted-foreground text-sm">
                    {t('stats.noData')}
                </div>
            )}
        </div>
    );
});

StatsPanel.displayName = 'StatsPanel';
