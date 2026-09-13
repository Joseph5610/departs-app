import React, { useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getRouteTypeI18nKey } from '../../../../utils/transitUtils';
import { FALLBACK_ROUTE_COLOR } from '../../../../config/constants';
import { STATS_AGGREGATION } from '../../../../config/transit';
import { VehicleMonitorRow } from '../VehicleMonitor/VehicleMonitorRow';
import type { EnrichedVehicleItem } from '../../../../hooks/derived/useVehicleMonitor';

import type { CityStats } from '../../../../types/transit';

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

export const MostDelayedCard: React.FC<MostDelayedCardProps> = ({ stats }) => {
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
        <Card variant="subtle" size="none">
            <CardHeader className="p-3.5 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                    <AlertTriangle size={16} className="text-rose-400" />
                    <span>{t('stats.biggestDelays')}</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 pt-0 flex flex-col gap-3">
                {/* Mode Filter Pills */}
                {delayTypes.length > 1 && (
                    <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
                        <Badge
                            variant={delayFilterType === 'all' ? 'default' : 'secondary'}
                            className="cursor-pointer whitespace-nowrap text-[10px] h-5 px-2"
                            onClick={() => setDelayFilterType('all')}
                        >
                            {t('common.all')}
                        </Badge>
                        {delayTypes.map(tType => (
                            <Badge
                                key={tType}
                                variant={delayFilterType === tType ? 'default' : 'secondary'}
                                className="cursor-pointer whitespace-nowrap text-[10px] h-5 px-2"
                                onClick={() => setDelayFilterType(tType)}
                            >
                                {t(getRouteTypeI18nKey(tType))}
                            </Badge>
                        ))}
                    </div>
                )}

                <div className="flex flex-col -mx-3.5">
                    {displayedItems.map(item => <VehicleMonitorRow key={item.id} item={item} />)}
                </div>

                {filteredDelayed.length > STATS_AGGREGATION.MOST_DELAYED_PREVIEW && (
                    <Button
                        variant="ghost"
                        onClick={() => setIsDelayedExpanded(!isDelayedExpanded)}
                        className="w-full mt-2 h-7 text-[11px] font-medium text-foreground/60 hover:text-foreground hover:bg-muted/50 bg-muted/50 border border-border/50 rounded-lg"
                    >
                        {isDelayedExpanded
                            ? t('stats.showLess')
                            : t('stats.showMore', { count: filteredDelayed.length - STATS_AGGREGATION.MOST_DELAYED_PREVIEW })}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
};
