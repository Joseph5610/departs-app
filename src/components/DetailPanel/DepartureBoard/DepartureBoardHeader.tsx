
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownAz, Clock, Star, MapPin, Share2, ChevronRight, Activity } from 'lucide-react';
import { usePreferences } from '../../../state/MapStateProvider';
import { useShare } from '../../../hooks/features/useShare';
import { useSelectedStop } from '../../../hooks/derived/useSelectedStop';
import { useSelectedVehicle } from '../../../hooks/derived/useSelectedVehicle';
import { useDepartures } from '../../../hooks/data/useDepartures';
import { useNavigate } from '../../../hooks/features/useNavigate';
import { HStack } from '@/components/ui/layout';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

/**
 * DepartureBoardHeader
 * 
 * Sticky subheader for the departure board.
 * Contains distance info and action buttons (Share, Favorite, Sort).
 */
export const DepartureBoardHeader = React.memo(() => {
    const { t } = useTranslation();
    const { state, actions } = usePreferences();
    const { share } = useShare();

    // Derived state
    const selectedStop = useSelectedStop();
    const selectedVehicle = useSelectedVehicle();

    const { departureSort, favoriteStops } = state;
    const { setDepartureSort, toggleFavorite } = actions;

    const showHeader = !!selectedStop && !selectedVehicle;
    const isFavorite = selectedStop ? favoriteStops.includes(selectedStop.stop_id) : false;

    const { handleNavigate, distanceLabel } = useNavigate();
    const { delayStats } = useDepartures();

    const handleShare = useCallback(() => {
        if (selectedStop) {
            share({
                title: t('map.departures.shareTitle', { name: selectedStop.stop_name }),
                text: t('map.departures.shareText', { name: selectedStop.stop_name }),
                stopId: selectedStop.stop_id
            });
        }
    }, [selectedStop, share, t]);

    if (!showHeader) {
        return null;
    }

    return (
        <div className="px-6 pb-2 shrink-0 flex flex-col gap-3">
            <HStack className="w-full gap-2 overflow-x-auto no-scrollbar pb-1" justify="start">
                <Button
                    variant="tinted"
                    size="sm"
                    onClick={handleNavigate}
                    className="h-8 rounded-xl px-3 gap-2 shrink-0 border-white/20!"
                >
                    <MapPin size={12} className="text-muted-foreground/60" />
                    <span className="font-bold text-foreground text-[11px]">
                        {distanceLabel}
                    </span>
                    <ChevronRight size={10} className="text-muted-foreground/40" />
                </Button>

                {delayStats && delayStats.sampleSize >= 2 && (
                    <Popover>
                        <PopoverTrigger 
                            className="h-8 shrink-0 rounded-xl px-3 gap-1.5 flex items-center bg-white/5 border border-white/10 hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20"
                            aria-label={t('map.departures.delayStatsTooltip', { count: delayStats.sampleSize })}
                        >
                            <Activity size={12} className={cn(
                                delayStats.trend === 'worsening' ? "text-red-400" :
                                delayStats.trend === 'improving' ? "text-emerald-400" :
                                "text-amber-400"
                            )} />
                            <span className="font-bold text-foreground text-[11px] whitespace-nowrap opacity-90">
                                {delayStats.averageDelayMin === 0 
                                    ? t('map.departures.onTime') 
                                    : `~${delayStats.averageDelayMin > 0 ? '+' : ''}${delayStats.averageDelayMin} min`}
                                {delayStats.trend === 'worsening' && <span className="ml-1">↑</span>}
                                {delayStats.trend === 'improving' && <span className="ml-1">↓</span>}
                            </span>
                        </PopoverTrigger>
                        <PopoverContent side="bottom" sideOffset={8} className="text-xs w-auto px-3 py-2 bg-popover/95 backdrop-blur-md border-white/10 z-[5000]">
                            {t('map.departures.delayStatsTooltip', { count: delayStats.sampleSize })}
                        </PopoverContent>
                    </Popover>
                )}
            </HStack>

            <HStack justify="between">
                <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest">
                    {t('map.departures.upcoming')}
                </span>
                <HStack gap={2}>
                    <Button
                        variant="tinted"
                        size="icon"
                        onClick={handleShare}
                        className="h-8 w-8 rounded-lg"
                    >
                        <Share2 size={14} />
                    </Button>
                    <Button
                        variant="tinted"
                        size="icon"
                        onClick={() => { if (selectedStop) { toggleFavorite(selectedStop.stop_id); } }}
                        className={cn(
                            "h-8 w-8 rounded-lg transition-all",
                            isFavorite && "bg-amber-500/10 border-amber-500/20! text-amber-500 hover:bg-amber-500/20!"
                        )}
                    >
                        <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
                    </Button>

                    <ToggleGroup
                        value={[departureSort]}
                        onValueChange={(val) => {
                            if (Array.isArray(val) && val[0]) {
                                setDepartureSort(val[0] as 'line' | 'departure');
                            }
                        }}
                        className="bg-muted/30 rounded-lg h-8 overflow-hidden"
                    >
                        <ToggleGroupItem
                            value="line"
                            className="h-full px-2.5"
                            title={t('map.departures.sortByLine')}
                        >
                            <ArrowDownAz size={16} />
                        </ToggleGroupItem>
                        <ToggleGroupItem
                            value="departure"
                            className="h-full px-2.5"
                            title={t('map.departures.sortByDeparture')}
                        >
                            <Clock size={16} />
                        </ToggleGroupItem>
                    </ToggleGroup>
                </HStack>
            </HStack>
        </div>
    );
});

DepartureBoardHeader.displayName = 'DepartureBoardHeader';
