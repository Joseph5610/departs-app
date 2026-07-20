import React, { useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { getRouteTypeI18nKey } from '../../../../utils/transitUtils';
import { LineBadge } from '../../../LineBadge';
import type { AppCityStats } from '../../../../../functions/_core/types';

interface MostDelayedCardProps {
    stats: AppCityStats;
    selectedCity: string;
}

export const MostDelayedCard: React.FC<MostDelayedCardProps> = ({ stats, selectedCity }) => {
    const { t } = useTranslation();
    const [, setLocation] = useLocation();
    const [isDelayedExpanded, setIsDelayedExpanded] = useState(false);
    const [delayFilterType, setDelayFilterType] = useState<string | 'all'>('all');

    const delayTypes = useMemo(() => {
        if (!stats?.most_delayed) return [];
        const types = new Set<string>();
        stats.most_delayed.forEach(v => {
            if (v.route_type !== undefined) types.add(String(v.route_type).toLowerCase());
        });
        return Array.from(types);
    }, [stats]);

    const filteredDelayed = useMemo(() => {
        if (!stats?.most_delayed) return [];
        if (delayFilterType === 'all') return stats.most_delayed;
        return stats.most_delayed.filter(v => String(v.route_type).toLowerCase() === delayFilterType);
    }, [stats, delayFilterType]);

    if (!stats.most_delayed || stats.most_delayed.length === 0) {
        return null;
    }

    return (
        <Card variant="subtle" className="p-0 gap-0 rounded-2xl">
            <CardHeader className="p-3.5 pb-2 space-y-0">
                <CardTitle className="flex items-center gap-2 text-[14px]">
                    <AlertTriangle size={16} className="text-rose-400" />
                    <span>{t('stats.biggestDelays')}</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 pt-0">
                {delayTypes.length > 1 && (
                    <div className="flex gap-1 mb-3 overflow-x-auto no-scrollbar pb-1">
                        <Badge 
                            variant={delayFilterType === 'all' ? "default" : "secondary"}
                            className="cursor-pointer whitespace-nowrap text-[10px] h-5 px-2"
                            onClick={() => setDelayFilterType('all')}
                        >
                            {t('common.all')}
                        </Badge>
                        {delayTypes.map(tType => (
                            <Badge
                                key={tType}
                                variant={delayFilterType === tType ? "default" : "secondary"}
                                className="cursor-pointer whitespace-nowrap text-[10px] h-5 px-2"
                                onClick={() => setDelayFilterType(tType)}
                            >
                                {t(getRouteTypeI18nKey(tType))}
                            </Badge>
                        ))}
                    </div>
                )}
                <div className="flex flex-col gap-1">
                    {(isDelayedExpanded ? filteredDelayed : filteredDelayed.slice(0, 5)).map((v) => (
                        <div 
                            key={`${v.gtfs_trip_id}-${v.vehicle_id}`}
                            onClick={() => {
                                if (v.gtfs_trip_id && v.gtfs_trip_id !== 'N/A') {
                                    if (v.vehicle_id && v.vehicle_id !== v.gtfs_trip_id) {
                                        setLocation(`/${selectedCity}/trip/${encodeURIComponent(v.gtfs_trip_id)}/${encodeURIComponent(v.vehicle_id)}`);
                                    } else {
                                        setLocation(`/${selectedCity}/trip/${encodeURIComponent(v.gtfs_trip_id)}`);
                                    }
                                }
                            }}
                            className="flex items-center justify-between hover:bg-muted/50 p-1.5 -mx-1.5 rounded-lg transition-colors text-left cursor-pointer group"
                            role="button"
                            tabIndex={0}
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <LineBadge 
                                    name={v.line} 
                                    routeColor={v.route_color || '#5A5A5A'} 
                                    size="lg"
                                    className="mr-1"
                                />
                                <span className="text-[13px] font-medium text-foreground/80 tabular-nums truncate">
                                    #{v.gtfs_trip_id !== 'N/A' ? v.gtfs_trip_id : v.vehicle_id}
                                </span>
                            </div>
                            <span className="shrink-0 text-[12px] ml-2 font-bold text-rose-400 tabular-nums bg-rose-500/10 px-2 py-0.5 rounded-full group-hover:bg-rose-500/20 transition-colors">
                                +{Math.round(v.delay / 60)} min
                            </span>
                        </div>
                    ))}
                </div>
                {filteredDelayed.length > 5 && (
                    <Button
                        variant="ghost"
                        onClick={() => setIsDelayedExpanded(!isDelayedExpanded)}
                        className="w-full mt-2 h-7 text-[11px] font-medium text-foreground/60 hover:text-foreground hover:bg-muted/50 bg-muted/50 border border-border/50 rounded-lg"
                    >
                        {isDelayedExpanded ? t('stats.showLess') : t('stats.showMore', { count: filteredDelayed.length - 5 })}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
};
