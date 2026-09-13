import React, { useMemo } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import { useVehicles } from '../../../hooks/data/useVehicles';
import { useNetworkVehicles } from '../../../hooks/data/useNetworkVehicles';
import { useCityStats } from '../../../hooks/data/useCityStats';
import { usePreferencesStore } from '../../../state/preferencesStore';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from 'react-i18next';
import { useCityConfig } from '../../../hooks/data/useCities';
import { aggregateCityStats } from '../../../utils/statsAggregator';
import { VehicleMonitorList } from './VehicleMonitor/VehicleMonitorList';
import { SegmentedControl } from '../../SegmentedControl';

import { PunctualityCard } from './cards/PunctualityCard';
import { MovementStateCard } from './cards/MovementStateCard';
import { MostDelayedCard } from './cards/MostDelayedCard';
import { VehicleMixCard } from './cards/VehicleMixCard';
import { BusiestLinesCard } from './cards/BusiestLinesCard';
import { OtherDataCard } from './cards/OtherDataCard';

export const StatsPanel = React.memo(() => {
    const cityConfig = useCityConfig();
    const { t } = useTranslation();
    
    const hasEnrichment = !!cityConfig.enrichmentChannel;
    
    const tab = usePreferencesStore(s => s.statsTab);
    const setTab = usePreferencesStore(s => s.actions.setStatsTab);
    const viewMode = usePreferencesStore(s => s.statsViewMode);

    const { vehicles } = useVehicles();
    const { data: networkVehicles, isFetching: isNetworkFetching } = useNetworkVehicles(tab === 'network');
    
    const screenStats = useMemo(
        () => (vehicles?.features ? aggregateCityStats(vehicles.features) : null),
        [vehicles]
    );

    const enrichedNetworkStats = useMemo(
        () => (networkVehicles?.features?.length ? aggregateCityStats(networkVehicles.features) : null),
        [networkVehicles]
    );

    const { data: networkApiStats, isFetching: isApiFetching } = useCityStats(tab === 'network');

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
                    {t('stats.scopeLabel')}
                </span>

                <SegmentedControl
                    value={tab}
                    onChange={setTab}
                    options={[
                        { value: 'screen', label: t('stats.onScreen') },
                        { value: 'network', label: t('stats.network') },
                    ]}
                />
            </div>

            {isFetching ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground opacity-60">
                    <Activity className="animate-pulse" size={24} />
                    <span className="text-sm font-medium">{t('common.loading')}</span>
                </div>
            ) : activeStats && activeStats.total_vehicles > 0 ? (
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
                                {t('stats.networkDelayNotice')}
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Delay Dependent Charts */}
                    {(tab === 'screen' || hasNetworkDelayData) && (
                        <>
                            <PunctualityCard stats={activeStats} />
                            <MostDelayedCard stats={activeStats} />
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
