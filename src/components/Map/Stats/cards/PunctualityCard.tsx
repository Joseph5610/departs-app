import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CityStats } from '../../../../types/transit';
import { DistributionBar } from '../DistributionBar';

interface PunctualityCardProps {
    stats: CityStats;
}

export const PunctualityCard: React.FC<PunctualityCardProps> = ({ stats }) => {
    const { t, i18n } = useTranslation();

    const { on_time, delayed_1_to_5, delayed_5_plus } = stats.delay_distribution;
    // Only vehicles reporting a delay are bucketed, so shares are of those, not of all vehicles.
    const withDelay = on_time + delayed_1_to_5 + delayed_5_plus;

    const formatDelay = (delaySec: number | null) => {
        if (delaySec === null) return '-';
        const value = new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(delaySec / 60);
        return t('stats.minutesValue', { value });
    };

    return (
        <Card variant="subtle" size="none">
            <CardHeader className="p-3.5 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                    <Clock size={16} className="text-emerald-400" />
                    <span>{t('stats.punctuality')}</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 pt-0">
                <div className="flex justify-between items-end mb-2.5">
                    <div>
                        <div className="text-3xl font-black tracking-tighter leading-none">
                            {formatDelay(stats.average_delay)}
                        </div>
                        <div className="text-[11px] font-medium text-foreground/60 mt-1">{t('stats.averageDelay')}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-xl font-bold text-red-400 tabular-nums leading-none">
                            {stats.delayed_over_5_min_count}
                        </div>
                        <div className="text-[11px] font-medium text-foreground/60 mt-1">{t('stats.delayedOver5')}</div>
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
            </CardContent>
        </Card>
    );
};
