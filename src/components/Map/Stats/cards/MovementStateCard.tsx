import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Navigation2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AppCityStats } from '../../../../../functions/_core/types';

interface MovementStateCardProps {
    stats: AppCityStats;
}

export const MovementStateCard: React.FC<MovementStateCardProps> = ({ stats }) => {
    const { t } = useTranslation();

    if (!stats.state_distribution) {
        return null;
    }

    return (
        <Card variant="subtle" className="p-0 gap-0 rounded-2xl">
            <CardHeader className="p-3.5 pb-2 space-y-0">
                <CardTitle className="flex items-center gap-2 text-[14px]">
                    <Navigation2 size={16} className="text-sky-400" />
                    <span>{t('stats.movementState')}</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 pt-0">
                <div className="flex flex-col gap-2 mt-1">
                    <div className="h-3.5 w-full flex rounded-full overflow-hidden opacity-90 border border-border/50 shadow-inner">
                        <Popover>
                            <PopoverTrigger className="h-full block p-0 border-none" style={{ width: `${(stats.state_distribution.in_transit / stats.total_vehicles) * 100}%` }}>
                                <div className="bg-sky-400 h-full cursor-pointer hover:opacity-80 transition-opacity w-full" />
                            </PopoverTrigger>
                            <PopoverContent className="w-auto px-3 py-1.5 text-sm" side="top">
                                {t('stats.inTransit')}: {stats.state_distribution.in_transit} {t('stats.vehicles')}
                            </PopoverContent>
                        </Popover>
                        
                        <Popover>
                            <PopoverTrigger className="h-full block p-0 border-none" style={{ width: `${(stats.state_distribution.at_stop / stats.total_vehicles) * 100}%` }}>
                                <div className="bg-indigo-400 h-full cursor-pointer hover:opacity-80 transition-opacity w-full" />
                            </PopoverTrigger>
                            <PopoverContent className="w-auto px-3 py-1.5 text-sm" side="top">
                                {t('stats.atStop')}: {stats.state_distribution.at_stop} {t('stats.vehicles')}
                            </PopoverContent>
                        </Popover>

                        <Popover>
                            <PopoverTrigger className="h-full block p-0 border-none" style={{ width: `${(stats.state_distribution.off_track / stats.total_vehicles) * 100}%` }}>
                                <div className="bg-amber-500 h-full cursor-pointer hover:opacity-80 transition-opacity w-full" />
                            </PopoverTrigger>
                            <PopoverContent className="w-auto px-3 py-1.5 text-sm" side="top">
                                {t('stats.offTrack')}: {stats.state_distribution.off_track} {t('stats.vehicles')}
                            </PopoverContent>
                        </Popover>

                        <Popover>
                            <PopoverTrigger className="h-full block p-0 border-none" style={{ width: `${(stats.state_distribution.other / stats.total_vehicles) * 100}%` }}>
                                <div className="bg-foreground/20 h-full cursor-pointer hover:opacity-80 transition-opacity w-full" />
                            </PopoverTrigger>
                            <PopoverContent className="w-auto px-3 py-1.5 text-sm" side="top">
                                {t('stats.unknownState')}: {stats.state_distribution.other} {t('stats.vehicles')}
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="flex flex-wrap justify-between text-[10px] font-bold text-foreground/60 uppercase tracking-wider gap-x-3 gap-y-1 mt-1">
                        <span className="text-sky-400">{t('stats.inTransit')} ({Math.round((stats.state_distribution.in_transit / stats.total_vehicles) * 100)}%)</span>
                        <span className="text-indigo-400 text-center">{t('stats.atStop')} ({Math.round((stats.state_distribution.at_stop / stats.total_vehicles) * 100)}%)</span>
                        <span className="text-amber-500 text-right">{t('stats.offTrack')} ({Math.round((stats.state_distribution.off_track / stats.total_vehicles) * 100)}%)</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
