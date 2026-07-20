import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AppCityStats } from '../../../../../functions/_core/types';

interface OtherDataCardProps {
    activeStats: AppCityStats;
    networkStats?: AppCityStats;
}

export const OtherDataCard: React.FC<OtherDataCardProps> = ({ activeStats, networkStats }) => {
    const { t } = useTranslation();

    const renderStatRow = (label: string, value: React.ReactNode) => (
        <div className="flex justify-between items-center py-2.5 border-b border-border/50 last:border-0">
            <span className="text-[15px] font-medium text-foreground/80">{label}</span>
            <span className="text-[15px] font-bold text-foreground tabular-nums tracking-tight">
                {value}
            </span>
        </div>
    );

    const formatPercentage = (count: number, total: number) => {
        if (total === 0) return '-';
        const percent = Math.round((count / total) * 100);
        return `${count} (${percent} %)`;
    };

    const showLowFloor = !networkStats || networkStats.low_floor_count > 0 || activeStats.low_floor_count > 0;
    const showAirCond = !networkStats || networkStats.air_conditioned_count > 0 || activeStats.air_conditioned_count > 0;

    if (!showLowFloor && !showAirCond && activeStats.total_delay_seconds <= 0) {
        return null;
    }

    return (
        <Card variant="subtle" className="p-0 gap-0 rounded-2xl mb-4">
            <CardHeader className="p-3.5 pb-2 space-y-0">
                <CardTitle className="flex items-center gap-2 text-[14px]">
                    <TrendingUp size={16} className="text-primary" />
                    <span>{t('stats.otherData')}</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 pt-0">
                <div className="flex flex-col">
                    {activeStats.total_delay_seconds > 0 &&
                        renderStatRow(t('stats.totalDelay'), <span className="text-rose-400 font-bold tabular-nums">+{Math.round(activeStats.total_delay_seconds / 3600)} h</span>)
                    }
                    
                    {showLowFloor && 
                        renderStatRow(t('stats.lowFloor'), formatPercentage(activeStats.low_floor_count, activeStats.total_vehicles))
                    }
                    
                    {showAirCond &&
                        renderStatRow(t('stats.airConditioned'), formatPercentage(activeStats.air_conditioned_count, activeStats.total_vehicles))
                    }
                </div>
            </CardContent>
        </Card>
    );
};
