import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FilterChip } from '@/components/FilterChip';
import { StatsCard } from './StatsCard';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getRouteTypeI18nKey } from '@/domain/routes';
import { FALLBACK_ROUTE_COLOR } from '@/config/constants';
import { STATS_AGGREGATION } from '@/config/transit';
import { VehicleMonitorRow } from '@/components/Map/Stats/VehicleMonitor/VehicleMonitorRow';
import type { EnrichedVehicleItem } from '@/domain/vehicles';

import type { CityStats } from '@/types';

const knownId = (id: string) => (id && id !== STATS_AGGREGATION.MISSING_ID ? id : undefined);

const toRowItem = (v: CityStats['most_delayed'][number]): EnrichedVehicleItem => ({
    id: `${v.gtfs_trip_id}-${v.vehicle_id}`,
    vehicleId: knownId(v.vehicle_id),
    gtfsTripId: knownId(v.gtfs_trip_id),
    line: v.line,
    routeType: v.route_type,
    routeColor: v.route_color || FALLBACK_ROUTE_COLOR,
    delay: v.delay,
});

interface MostDelayedCardProps {
    stats: CityStats;
}

export const MostDelayedCard = ({ stats }: MostDelayedCardProps) => {
    const { t } = useTranslation();
    const [isDelayedExpanded, setIsDelayedExpanded] = useState(false);
    const [delayFilterType, setDelayFilterType] = useState<string | 'all'>('all');

    const delayTypes = useMemo(() => {
        if (!stats?.most_delayed) return [];
        const types = new Set<string>();
        stats.most_delayed.forEach(v => {
            if (v.route_type !== undefined) types.add(v.route_type);
        });
        return Array.from(types);
    }, [stats]);

    const filteredDelayed = useMemo(() => {
        if (!stats?.most_delayed) return [];
        if (delayFilterType === 'all') return stats.most_delayed;
        return stats.most_delayed.filter(v => v.route_type === delayFilterType);
    }, [stats, delayFilterType]);

    if (!stats.most_delayed || stats.most_delayed.length === 0) {
        return null;
    }

    const displayedItems = (isDelayedExpanded ? filteredDelayed : filteredDelayed.slice(0, STATS_AGGREGATION.MOST_DELAYED_PREVIEW)).map(toRowItem);

    return (
        <StatsCard icon={AlertTriangle} title={t('stats.biggestDelays')} iconClassName="text-destructive">
            <div className="flex flex-col gap-3">
                {delayTypes.length > 1 && (
                    <div className="-my-2 flex gap-1.5 overflow-x-auto py-2 no-scrollbar">
                        <FilterChip label={t('common.all')} isActive={delayFilterType === 'all'} onClick={() => setDelayFilterType('all')} />
                        {delayTypes.map(tType => (
                            <FilterChip key={tType} label={t(getRouteTypeI18nKey(tType))} isActive={delayFilterType === tType} onClick={() => setDelayFilterType(tType)} />
                        ))}
                    </div>
                )}

                <div className="flex flex-col -mx-3.5">
                    {displayedItems.map(item => <VehicleMonitorRow key={item.id} item={item} />)}
                </div>

                {filteredDelayed.length > STATS_AGGREGATION.MOST_DELAYED_PREVIEW && (
                    <Button
                        variant="pill"
                        size="sm"
                        onClick={() => setIsDelayedExpanded(!isDelayedExpanded)}
                        className="mt-2 w-full"
                    >
                        {isDelayedExpanded
                            ? t('stats.showLess')
                            : t('stats.showMore', { count: filteredDelayed.length - STATS_AGGREGATION.MOST_DELAYED_PREVIEW })}
                    </Button>
                )}
            </div>
        </StatsCard>
    );
};
