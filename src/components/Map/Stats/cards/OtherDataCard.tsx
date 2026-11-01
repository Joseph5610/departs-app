import React from 'react';
import { Item } from '@/components/ui/item';
import { StatsCard } from './StatsCard';
import { TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CityStats } from '@/types';

interface OtherDataCardProps {
    activeStats: CityStats;
    networkStats?: CityStats | null;
}

export const OtherDataCard = ({ activeStats, networkStats }: OtherDataCardProps) => {
    const { t, i18n } = useTranslation();

    const renderStatRow = (label: string, value: React.ReactNode) => (
        <Item variant="row" size="none" className="justify-between [--row-sep:0.875rem]">
            <span className="type-row text-muted-foreground">{label}</span>
            <span className="type-headsign text-foreground tabular-nums">
                {value}
            </span>
        </Item>
    );

    const formatPercentage = (count: number, total: number) => {
        if (total === 0) return '-';
        const percent = new Intl.NumberFormat(i18n.resolvedLanguage, { style: 'percent', maximumFractionDigits: 0 }).format(count / total);
        return `${count} (${percent})`;
    };

    const showLowFloor = (networkStats?.low_floor_count ?? 0) > 0 || activeStats.low_floor_count > 0;
    const showAirCond = (networkStats?.air_conditioned_count ?? 0) > 0 || activeStats.air_conditioned_count > 0;

    if (!showLowFloor && !showAirCond && activeStats.total_delay_seconds <= 0) {
        return null;
    }

    return (
        <StatsCard icon={TrendingUp} title={t('stats.otherData')} iconClassName="text-tint-mint" className="mb-4" flush>
                <div className="flex flex-col">
                    {activeStats.total_delay_seconds > 0 &&
                        renderStatRow(t('stats.totalDelay'), <span className="text-destructive font-bold tabular-nums">{t('stats.hoursValue', { value: Math.round(activeStats.total_delay_seconds / 3600) })}</span>)
                    }
                    
                    {showLowFloor && 
                        renderStatRow(t('stats.lowFloor'), formatPercentage(activeStats.low_floor_count, activeStats.total_vehicles))
                    }
                    
                    {showAirCond &&
                        renderStatRow(t('stats.airConditioned'), formatPercentage(activeStats.air_conditioned_count, activeStats.total_vehicles))
                    }
                </div>
        </StatsCard>
    );
};
