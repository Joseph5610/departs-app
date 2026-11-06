import { StatsCard } from './StatsCard';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CityStats } from '@/types';
import { DistributionBar } from '@/components/Map/Stats/DistributionBar';
import { StatRow } from '@/components/Map/Stats/StatRow';
import { Separator } from '@/components/ui/separator';

interface PunctualityCardProps {
    stats: CityStats;
}

export const PunctualityCard = ({ stats }: PunctualityCardProps) => {
    const { t, i18n } = useTranslation();

    const { on_time, delayed_1_to_5, delayed_5_plus } = stats.delay_distribution;
    // Only vehicles reporting a delay are bucketed, so shares are of those, not of all vehicles.
    const withDelay = on_time + delayed_1_to_5 + delayed_5_plus;

    const formatMinutes = (delaySec: number | null) => {
        if (delaySec === null) return '-';
        const value = new Intl.NumberFormat(i18n.resolvedLanguage, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(delaySec / 60);
        return t('stats.minutesValue', { value });
    };

    return (
        <StatsCard icon={Clock} title={t('stats.punctuality')} iconClassName="text-emerald-400" flush>
            <div className="px-3.5 pb-3.5">
                <div className="flex justify-between items-end mb-2.5">
                    <div>
                        <div className="type-title tabular-nums">
                            {formatMinutes(stats.average_delay)}
                        </div>
                        <div className="type-note text-foreground/60 mt-1">{t('stats.averageDelay')}</div>
                    </div>
                    <div className="text-right">
                        <div className="type-title text-destructive tabular-nums">
                            {stats.delayed_over_5_min_count}
                        </div>
                        <div className="type-note text-foreground/60 mt-1">{t('stats.delayedOver5')}</div>
                    </div>
                </div>
                
                {withDelay > 0 && (
                    <div className="mt-4">
                        <DistributionBar
                            total={withDelay}
                            segments={[
                                { key: 'onTime', label: t('stats.onTime'), count: on_time, barClass: 'bg-emerald-500', textClass: 'text-emerald-400' },
                                { key: 'delayed1to5', label: t('stats.delayed1to5'), count: delayed_1_to_5, barClass: 'bg-amber-400', textClass: 'text-amber-400' },
                                { key: 'delayed5plus', label: t('stats.delayedOver5Plus'), count: delayed_5_plus, barClass: 'bg-rose-400', textClass: 'text-rose-400' },
                            ]}
                        />
                    </div>
                )}
            </div>
            {stats.total_delay_seconds > 0 && (
                <>
                    <Separator className="bg-sep data-horizontal:h-[0.5px]" />
                    <StatRow
                        label={t('stats.totalDelay')}
                        value={<span className="text-destructive">{t('stats.hoursValue', { value: Math.round(stats.total_delay_seconds / 3600) })}</span>}
                    />
                </>
            )}
        </StatsCard>
    );
};
