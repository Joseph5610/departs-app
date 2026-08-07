import React, { useMemo } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import { useVehicles } from '../../../hooks/data/useVehicles';
import { useNetworkVehicles } from '../../../hooks/data/useNetworkVehicles';
import { useCityStats } from '../../../hooks/data/useCityStats';
import { usePreferencesStore } from '../../../state/preferencesStore';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from 'react-i18next';
import { applyEnrichment } from '../../../lib/enrichment';
import { useEnrichmentStore } from '../../../state/enrichmentStore';
import { getCityConfig } from '../../../config/cities';
import { aggregateCityStats } from '../../../../functions/_core/utils/statsAggregator';
import type { AppVehicleFeature } from '../../../../functions/_core/types';
import { VehicleMonitorList } from './VehicleMonitor/VehicleMonitorList';
import { cn } from '@/lib/utils';

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
    
    const hasEnrichment = !!getCityConfig(selectedCity).enrichmentChannel;
    
    const tab = usePreferencesStore(s => s.statsTab);
    const setTab = usePreferencesStore(s => s.actions.setStatsTab);
    const viewMode = usePreferencesStore(s => s.statsViewMode);

    const { vehicles } = useVehicles();
    const { data: networkVehicles, isFetching: isNetworkFetching } = useNetworkVehicles();
    
    // Compute Screen Stats using the shared aggregator
    const screenStats = useMemo(() => {
        if (!vehicles || !vehicles.features) return null;

        // 1. Apply enrichment
        const enrichedFeatures = vehicles.features.map(f => {
            const vehicleId = f.properties.vehicle_id || f.properties.vehicle_descriptor?.vehicle_registration_number?.toString() || undefined;
            const p = applyEnrichment(
                f.properties,
                f.properties.gtfs_trip_id,
                vehicleId,
                byTripId,
                byVehicleId,
                0
            ) as typeof f.properties;
            
            return {
                ...f,
                properties: p
            } as typeof f;
        });

        // 2. Aggregate
        return aggregateCityStats(enrichedFeatures as unknown as AppVehicleFeature[]);
    }, [vehicles, byTripId, byVehicleId]);

    // Compute Network Stats client-side using networkVehicles + WS enrichment (full network delay support)
    const enrichedNetworkStats = useMemo(() => {
        if (!networkVehicles || !networkVehicles.features || networkVehicles.features.length === 0) return null;

        const enrichedFeatures = networkVehicles.features.map(f => {
            const vehicleId = f.properties.vehicle_id || f.properties.vehicle_descriptor?.vehicle_registration_number?.toString() || undefined;
            const p = applyEnrichment(
                f.properties,
                f.properties.gtfs_trip_id,
                vehicleId,
                byTripId,
                byVehicleId,
                0
            ) as typeof f.properties;

            return {
                ...f,
                properties: p
            } as typeof f;
        });

        return aggregateCityStats(enrichedFeatures as unknown as AppVehicleFeature[]);
    }, [networkVehicles, byTripId, byVehicleId]);

    const { data: networkApiStats, isFetching: isApiFetching } = useCityStats();

    if (viewMode === 'vehicles') {
        return <VehicleMonitorList />;
    }
    
    const activeStats = tab === 'screen' ? screenStats : (enrichedNetworkStats || networkApiStats);
    const isFetching = tab === 'network' && (isNetworkFetching || isApiFetching) && !activeStats;
    const hasNetworkDelayData = !hasEnrichment || !!enrichedNetworkStats;

    return (
        <div className="flex flex-col gap-0 pt-0">
            {/* Scope Switcher Header (Clean Segmented Control matching design system) */}
            <div className="flex items-center justify-between px-1 pb-3">
                <span className="text-xs font-semibold text-muted-foreground">
                    {t('stats.scopeLabel', 'Rozsah statistik:')}
                </span>

                <div className="flex items-center gap-0.5 bg-muted/30 p-0.5 rounded-lg border border-border/40">
                    <button
                        type="button"
                        onClick={() => setTab('screen')}
                        className={cn(
                            "px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer",
                            tab === 'screen'
                                ? "bg-background text-foreground shadow-2xs"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {t('stats.onScreen', 'Na obrazovce')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab('network')}
                        className={cn(
                            "px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer",
                            tab === 'network'
                                ? "bg-background text-foreground shadow-2xs"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {t('stats.network', 'Celá síť')}
                    </button>
                </div>
            </div>

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
                    {!hasNetworkDelayData && tab === 'network' && (
                        <Alert variant="warning">
                            <AlertTriangle size={16} />
                            <AlertDescription className="text-xs leading-relaxed">
                                {t('stats.networkDelayNotice', 'Live delay and movement data for the entire network is not available in this region. Please switch to the "On Screen" tab to see live data for vehicles currently in view.')}
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Delay Dependent Charts */}
                    {(tab === 'screen' || hasNetworkDelayData) && (
                        <>
                            <PunctualityCard stats={activeStats} />
                            <MostDelayedCard stats={activeStats} selectedCity={getCityConfig(selectedCity).slug} />
                        </>
                    )}

                    <MovementStateCard stats={activeStats} />
                    <VehicleMixCard stats={activeStats} />
                    <BusiestLinesCard stats={activeStats} />
                    <OtherDataCard activeStats={activeStats} networkStats={enrichedNetworkStats || networkApiStats} />
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
