import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AppCityStats } from '../../../../../functions/_core/types';

interface PunctualityCardProps {
    stats: AppCityStats;
}

export const PunctualityCard: React.FC<PunctualityCardProps> = ({ stats }) => {
    const { t } = useTranslation();

    const formatDelay = (delaySec: number | null) => {
        if (delaySec === null) return '-';
        const mins = delaySec / 60;
        return `${mins.toFixed(1)} min.`;
    };

    return (
        <Card variant="subtle" className="p-0 gap-0 rounded-2xl">
            <CardHeader className="p-3.5 pb-2 space-y-0">
                <CardTitle className="flex items-center gap-2 text-[14px]">
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
                
                <div className="flex flex-col gap-2 mt-4">
                    <div className="h-3.5 w-full flex rounded-full overflow-hidden opacity-90 border border-border/50 shadow-inner">
                        <Popover>
                            <PopoverTrigger className="h-full block p-0 border-none w-full" style={{ width: `${(stats.delay_distribution.on_time / stats.total_vehicles) * 100}%` }}>
                                <div className="bg-emerald-500 h-full cursor-pointer hover:opacity-80 transition-opacity w-full" />
                            </PopoverTrigger>
                            <PopoverContent className="w-auto px-3 py-1.5 text-sm" side="top">
                                {t('stats.onTime')}: {stats.delay_distribution.on_time} {t('stats.vehicles')}
                            </PopoverContent>
                        </Popover>
                        
                        <Popover>
                            <PopoverTrigger className="h-full block p-0 border-none w-full" style={{ width: `${(stats.delay_distribution.delayed_1_to_5 / stats.total_vehicles) * 100}%` }}>
                                <div className="bg-amber-400 h-full cursor-pointer hover:opacity-80 transition-opacity w-full" />
                            </PopoverTrigger>
                            <PopoverContent className="w-auto px-3 py-1.5 text-sm" side="top">
                                {t('stats.delayed1to5')}: {stats.delay_distribution.delayed_1_to_5} {t('stats.vehicles')}
                            </PopoverContent>
                        </Popover>

                        <Popover>
                            <PopoverTrigger className="h-full block p-0 border-none w-full" style={{ width: `${(stats.delay_distribution.delayed_5_plus / stats.total_vehicles) * 100}%` }}>
                                <div className="bg-rose-400 h-full cursor-pointer hover:opacity-80 transition-opacity w-full" />
                            </PopoverTrigger>
                            <PopoverContent className="w-auto px-3 py-1.5 text-sm" side="top">
                                {t('stats.delayedOver5Plus')}: {stats.delay_distribution.delayed_5_plus} {t('stats.vehicles')}
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="flex flex-wrap justify-between text-[10px] font-bold text-foreground/60 uppercase tracking-wider gap-x-3 gap-y-1 mt-1">
                        <span className="text-emerald-400">{t('stats.onTime')} ({Math.round((stats.delay_distribution.on_time / stats.total_vehicles) * 100)}%)</span>
                        <span className="text-amber-400">{t('stats.delayed1to5')} ({Math.round((stats.delay_distribution.delayed_1_to_5 / stats.total_vehicles) * 100)}%)</span>
                        <span className="text-rose-400">{t('stats.delayedOver5Plus')} ({Math.round((stats.delay_distribution.delayed_5_plus / stats.total_vehicles) * 100)}%)</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
