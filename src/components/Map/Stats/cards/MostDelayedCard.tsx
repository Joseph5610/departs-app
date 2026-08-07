import React, { useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ChevronRight } from 'lucide-react';
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

    const displayedItems = isDelayedExpanded ? filteredDelayed : filteredDelayed.slice(0, 5);

    return (
        <Card variant="subtle" size="none">
            <CardHeader className="p-3.5 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                    <AlertTriangle size={16} className="text-rose-400" />
                    <span>{t('stats.biggestDelays', 'Největší zpoždění')}</span>
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
                            {t('common.all', 'Vše')}
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

                {/* Rows — same layout as VehicleMonitorRow */}
                <div className="flex flex-col -mx-3.5">
                    {displayedItems.map((v) => {
                        const displayId = v.vehicle_id || '—';
                        const delayMinutes = Math.round(v.delay / 60);

                        return (
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
                                className="group flex items-center justify-between gap-3 px-3 py-2 border-b border-border/20 hover:bg-muted/40 transition-colors cursor-pointer select-none"
                                role="button"
                                tabIndex={0}
                            >
                                {/* Left: Line Badge & ID */}
                                <div className="flex items-center gap-2.5 shrink-0 min-w-40">
                                    <LineBadge
                                        name={v.line}
                                        routeColor={v.route_color || '#5A5A5A'}
                                        size="md"
                                        className="shadow-xs shrink-0"
                                    />
                                    <span className="text-xs font-semibold font-mono tracking-tight text-foreground/90 truncate max-w-28">
                                        {displayId}
                                    </span>
                                </div>

                                {/* Middle: spacer */}
                                <div className="flex items-center min-w-0 flex-1" />

                                {/* Right: Delay badge & chevron */}
                                <div className="flex items-center gap-2 shrink-0">
                                    <Badge
                                        variant="outline"
                                        className="text-[10px] font-bold tabular-nums px-2 py-0.5 border-transparent shadow-2xs bg-rose-500/10 text-rose-400 border-rose-500/20"
                                    >
                                        +{delayMinutes || 1} min
                                    </Badge>
                                    <ChevronRight size={14} className="text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {filteredDelayed.length > 5 && (
                    <Button
                        variant="ghost"
                        onClick={() => setIsDelayedExpanded(!isDelayedExpanded)}
                        className="w-full mt-2 h-7 text-[11px] font-medium text-foreground/60 hover:text-foreground hover:bg-muted/50 bg-muted/50 border border-border/50 rounded-lg"
                    >
                        {isDelayedExpanded
                            ? t('stats.showLess', 'Zobrazit méně')
                            : t('stats.showMore', { count: filteredDelayed.length - 5, defaultValue: `Zobrazit více (+${filteredDelayed.length - 5})` })}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
};
