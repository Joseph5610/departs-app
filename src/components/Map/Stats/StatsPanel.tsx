import { SectionHeading } from '@/components/SectionHeading';
import { useMemo, memo } from 'react';
import { AlertTriangle, BarChart3 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useVehicles } from '@/hooks/data/useVehicles';
import { usePreferencesStore } from '@/state/preferencesStore';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from 'react-i18next';
import { useCityConfig } from '@/hooks/data/useCities';
import { hasEnrichment } from '@/domain/cities';
import { aggregateCityStats } from '@/domain/vehicles';
import { VehicleMonitorList } from './VehicleMonitor/VehicleMonitorList';
import { SegmentedControl } from '@/components/SegmentedControl';

import { PunctualityCard } from './cards/PunctualityCard';
import { MovementStateCard } from './cards/MovementStateCard';
import { MostDelayedCard } from './cards/MostDelayedCard';
import { VehicleMixCard } from './cards/VehicleMixCard';
import { BusiestLinesCard } from './cards/BusiestLinesCard';
import { EmptyState } from '@/components/EmptyState';

/** One headline count: a small caps label over a big number. */
const StatTile = ({ label, value }: { label: string; value: number }) => (
    <Card size="none">
        <CardContent className="p-3.5 flex flex-col justify-center h-full">
            <SectionHeading className="mb-0.5">{label}</SectionHeading>
            <span className="type-display tabular-nums">{value}</span>
        </CardContent>
    </Card>
);

export const StatsPanel = memo(() => {
    const cityConfig = useCityConfig();
    const { t } = useTranslation();
    
    const hasCityEnrichment = hasEnrichment(cityConfig);
    
    const tab = usePreferencesStore(s => s.statsTab);
    const setTab = usePreferencesStore(s => s.actions.setStatsTab);
    const viewMode = usePreferencesStore(s => s.statsViewMode);

    const { vehicles, networkVehicles, isFetching: isNetworkFetching } = useVehicles();
    
    const screenStats = useMemo(
        () => (vehicles?.features ? aggregateCityStats(vehicles.features) : null),
        [vehicles]
    );

    const enrichedNetworkStats = useMemo(
        () => (networkVehicles?.features?.length ? aggregateCityStats(networkVehicles.features) : null),
        [networkVehicles]
    );

    if (viewMode === 'vehicles') {
        return <VehicleMonitorList />;
    }
    
    const activeStats = tab === 'screen' ? screenStats : enrichedNetworkStats;
    const isFetching = tab === 'network' && isNetworkFetching && !activeStats;
    const hasNetworkDelayData = !hasCityEnrichment || !!enrichedNetworkStats;

    return (
        <div className="flex flex-col gap-0 pt-0">
            <div className="flex items-center justify-between pb-3">
                <SectionHeading>{t('stats.scopeLabel')}</SectionHeading>

                <SegmentedControl
                    size="sm"
                    value={tab}
                    onChange={setTab}
                    options={[
                        { value: 'screen', label: t('stats.onScreen') },
                        { value: 'network', label: t('stats.network') },
                    ]}
                />
            </div>

            {isFetching ? (
                <div className="flex flex-col gap-3 py-2" aria-hidden="true">
                    <div className="grid grid-cols-2 gap-3">
                        <Skeleton className="h-21 rounded-surface" />
                        <Skeleton className="h-21 rounded-surface" />
                    </div>
                    <Skeleton className="h-40 rounded-surface" />
                    <Skeleton className="h-32 rounded-surface" />
                </div>
            ) : activeStats && activeStats.total_vehicles > 0 ? (
                <div className="flex flex-col gap-3 pt-2 pb-2">
                    <div className="grid grid-cols-2 gap-3">
                        <StatTile label={t('stats.vehicles')} value={activeStats.total_vehicles} />
                        <StatTile label={t('stats.lines')} value={activeStats.total_lines} />
                    </div>

                    {!hasNetworkDelayData && tab === 'network' && (
                        <Alert variant="warning">
                            <AlertTriangle size={16} />
                            <AlertDescription className="type-note">
                                {t('stats.networkDelayNotice')}
                            </AlertDescription>
                        </Alert>
                    )}

                    {(tab === 'screen' || hasNetworkDelayData) && (
                        <>
                            <PunctualityCard stats={activeStats} />
                            <MostDelayedCard stats={activeStats} />
                        </>
                    )}

                    <MovementStateCard stats={activeStats} />
                    <VehicleMixCard stats={activeStats} networkStats={enrichedNetworkStats} />
                    <BusiestLinesCard stats={activeStats} />
                </div>
            ) : (
                <EmptyState icon={BarChart3} title={t('stats.noData')} />
            )}
        </div>
    );
});

StatsPanel.displayName = 'StatsPanel';
