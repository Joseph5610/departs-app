import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownAz, Clock, Star, MapPin, Share2, ChevronRight, Activity } from 'lucide-react';
import { FALLBACK_ROUTE_COLOR } from '../../../config/constants';
import { usePreferences, useSelection } from '../../../state/contexts';
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
    const { state: selState, actions: selActions } = useSelection();
    const selectedStop = useSelectedStop();
    const selectedVehicle = useSelectedVehicle();

    const { departureSort, favoriteStops } = state;
    const { setDepartureSort, toggleFavorite } = actions;
    const { selectedLine } = selState;
    const { toggleLineFilter } = selActions;

    const showHeader = !!selectedStop && !selectedVehicle;
    const isFavorite = selectedStop ? favoriteStops.includes(selectedStop.stop_id) : false;

    const { handleNavigate, distanceLabel } = useNavigate();
    const { delayStats } = useDepartures();

    const uniqueLines = React.useMemo(() => {
        if (!selectedStop?.lines) return [];
        const seen = new Set<string>();
        return selectedStop.lines.filter(line => {
            if (seen.has(line.name)) return false;
            seen.add(line.name);
            return true;
        });
    }, [selectedStop?.lines]);

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
            <HStack className="w-full gap-2 pb-1" justify="start">
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

            {selectedStop?.lines && selectedStop.lines.length > 0 && (
                <div className="relative w-full">
                    <div 
                        className="w-full overflow-x-auto no-scrollbar -mx-1 px-1 py-1.5"
                        style={{ 
                            maskImage: 'linear-gradient(to right, black calc(100% - 40px), transparent 100%)',
                            WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 40px), transparent 100%)'
                        }}
                    >
                        <HStack className="gap-1.5 px-1" justify="start">
                            {uniqueLines.map((line) => {
                                const name = String(line.name || '');
                                if (!name) return null;

                                const isActive = selectedLine === name;
                                const isDimmed = !!selectedLine && !isActive;

                                return (
                                 <button 
                                 key={name}
                                 onClick={() => toggleLineFilter(name)}
                                 className={cn(
                                     "inline-flex items-center justify-center text-[10.5px] text-white font-bold shrink-0 transition-all active:scale-95 select-none shadow-sm cursor-pointer hover:brightness-110",
                                     // Metro lines are circular
                                     (line.type === '1' || ['A', 'B', 'C'].includes(name)) 
                                         ? "rounded-full w-[21px] h-[21px]" 
                                         : "rounded-[4px] h-[21px]",
                                     // Adjust padding for longer names
                                     name.length >= 2 
                                         ? (line.type === '1' ? "" : "px-2 min-w-[21px]") 
                                         : "w-[21px]",
                                     isDimmed ? "opacity-25 scale-90" : "opacity-100",
                                     isActive && "ring-2 ring-white ring-offset-1 ring-offset-background z-10 scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]"
                                 )}
                                 style={{ 
                                     backgroundColor: line.route_color || FALLBACK_ROUTE_COLOR,
                                     border: '1px solid rgba(255,255,255,0.1)'
                                 }}
                             >
                                 {name}
                             </button>
                             );
                            })}
                            {/* Spacer to allow scrolling past the mask/fade zone */}
                            <div className="shrink-0 w-10 h-1" />
                        </HStack>
                    </div>
                </div>
            )}

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
