import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownAz, Clock, Star, MapPin, Share2, Activity, ExternalLink, Footprints } from 'lucide-react';
import { FALLBACK_ROUTE_COLOR } from '../../../config/constants';
import { usePreferences, useSelection } from '../../../state/contexts';
import { useShare } from '../../../hooks/features/useShare';
import { useSelectedStop } from '../../../hooks/derived/useSelectedStop';
import { useSelectedVehicle } from '../../../hooks/derived/useSelectedVehicle';
import { useDepartures } from '../../../hooks/data/useDepartures';
import { useNavigate } from '../../../hooks/features/useNavigate';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { HStack } from '@/components/ui/layout';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { LineBadge } from '../../LineBadge';
import { toast } from 'sonner';

/**
 * DepartureBoardHeader
 * 
 * Sticky subheader for the departure board.
 * Compact 2-row layout:
 *   Row 1: [Distance pill] [Delay indicator] [PID link]
 *   Row 2: [Line badges ...] [Share] [Fav] [Sort toggle]
 */
export const DepartureBoardHeader = React.memo(() => {
    const { t } = useTranslation();
    const { state, actions } = usePreferences();
    const { share } = useShare();
    const isMobile = useIsMobile();

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

    const { handleNavigate, distanceLabel, stopDistanceInfo } = useNavigate();
    const { delayStats } = useDepartures();

    const uniqueLines = React.useMemo(() => {
        if (!selectedStop?.lines) return [];
        const seen = new Set<string>();
        const lines = selectedStop.lines.filter(line => {
            if (seen.has(line.name)) return false;
            seen.add(line.name);
            return true;
        });

        const getLineGroup = (line: { name: string, type: string }) => {
            const name = line.name.toUpperCase();
            const typeStr = String(line.type);
            
            if (typeStr === '1' || typeStr === 'metro' || ['A', 'B', 'C'].includes(name)) return 0; // Metro
            if (typeStr === '2' || typeStr === 'train' || name.startsWith('S') || name.startsWith('R')) return 1; // Train
            
            const num = parseInt(name.replace(/\D/g, ''), 10);
            const isNightTram = (typeStr === '0' || typeStr === 'tram') && !isNaN(num) && num >= 90 && num < 100;
            const isNightBus = (typeStr === '3' || typeStr === 'bus') && !isNaN(num) && num >= 900;

            if (typeStr === '0' || typeStr === 'tram') return isNightTram ? 6 : 2; // Tram / Night Tram
            if (typeStr === '3' || typeStr === 'bus') return isNightBus ? 7 : 3; // Bus / Night Bus
            if (typeStr === '11' || typeStr === 'trolleybus') return 4; // Trolleybus
            if (typeStr === '4' || typeStr === 'ferry' || typeStr === '7' || typeStr === 'funicular') return 5; // Other
            
            return 8; // Unknown
        };

        return lines.sort((a, b) => {
            const groupA = getLineGroup(a);
            const groupB = getLineGroup(b);
            if (groupA !== groupB) return groupA - groupB;
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        });
    }, [selectedStop]);

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
        <div className="px-6 pb-0 shrink-0 flex flex-col gap-2">
            {/* Row 1: Distance/Delay (Left) + Actions (Right) */}
            <HStack className="w-full h-7" justify="between" align="center">
                <HStack className="gap-2 shrink-0" align="center">
                    <div className="flex items-center h-7 rounded-full bg-white/10 border border-white/5 shadow-sm shrink-0 overflow-hidden">
                        {/* Distance & Walking Time segment */}
                        <div 
                            className="flex items-center h-full px-3 hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer"
                            onClick={handleNavigate}
                        >
                             <MapPin size={12} className="text-muted-foreground/80 mr-1.5"  strokeWidth={1.5} />
                             <span className="font-bold text-foreground text-[11px] tracking-tight whitespace-nowrap flex items-center">
                                {stopDistanceInfo?.isReasonableWalkingDistance ? (
                                    <>
                                        <span>{stopDistanceInfo.distance}m</span>
                                        <span className="mx-1.5 opacity-30 font-normal">•</span>
                                        <Footprints size={14} className="mr-1 text-muted-foreground/60"  strokeWidth={1.5} />
                                        <span>{stopDistanceInfo.time} min</span>
                                    </>
                                ) : (
                                    distanceLabel.split(' • ')[0]
                                )}
                             </span>
                        </div>

                        {/* Delay Statistics segment */}
                        {delayStats && delayStats.sampleSize >= 2 && (
                            <>
                                <div className="w-px h-3 bg-white/10 shrink-0" />
                                <Tooltip>
                                    <TooltipTrigger render={
                                        <div className="flex items-center h-full px-3 hover:bg-white/5 transition-colors cursor-help">
                                            <Activity size={12} className={cn(
                                                "mr-1.5",
                                                delayStats.trend === 'worsening' ? "text-red-400" :
                                                delayStats.trend === 'improving' ? "text-emerald-400" :
                                                "text-amber-400"
                                            )}  strokeWidth={1.5} />
                                            <span className="font-bold text-foreground text-[11px] tracking-tight opacity-90 whitespace-nowrap">
                                                {delayStats.averageDelayMin === 0 
                                                    ? t('map.departures.onTime') 
                                                    : `~${delayStats.averageDelayMin > 0 ? '+' : ''}${delayStats.averageDelayMin} min`}
                                            </span>
                                        </div>
                                    } />
                                    <TooltipContent side="bottom">
                                        {t('map.departures.delayStatsTooltip', { count: delayStats.sampleSize })}
                                    </TooltipContent>
                                </Tooltip>
                            </>
                        )}
                    </div>
                </HStack>

                <HStack gap={1} className="shrink-0 items-center pr-1">
                    {/* Sort Action */}
                    <Tooltip>
                        <TooltipTrigger render={
                            <button
                                onClick={() => setDepartureSort(departureSort === 'line' ? 'departure' : 'line')}
                                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors text-muted-foreground opacity-40 hover:opacity-100 hover:text-foreground"
                            >
                                {/* Show the ACTION you will take: if sorted by line, show Clock. If sorted by departure, show A-Z. */}
                                {departureSort === 'line' ? <Clock size={16}  strokeWidth={1.5} /> : <ArrowDownAz size={16}  strokeWidth={1.5} />}
                            </button>
                        } />
                        <TooltipContent side="bottom" className="text-[11px] px-2 py-1">
                            {departureSort === 'line' ? t('map.departures.sortByDeparture') : t('map.departures.sortByLine')}
                        </TooltipContent>
                    </Tooltip>

                    {/* Official Link – desktop only (PID web board doesn't work well on mobile) */}
                    {!isMobile && (
                        <Tooltip>
                            <TooltipTrigger render={
                                <a 
                                    href={`https://data.pid.cz/departures/?ids=${selectedStop.stop_id.replace(/,/g, ';')}&title=${encodeURIComponent(selectedStop.stop_name || '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors text-muted-foreground opacity-40 hover:opacity-100 hover:text-foreground"
                                >
                                    <ExternalLink size={16}  strokeWidth={1.5} />
                                </a>
                            } />
                            <TooltipContent side="bottom" className="text-[11px] px-2 py-1">
                                {t('map.departures.officialBoard')}
                            </TooltipContent>
                        </Tooltip>
                    )}

                    {/* Favorite */}
                    <Tooltip>
                        <TooltipTrigger render={
                            <button
                                data-testid="favorite-btn"
                                onClick={() => {
                                    if (selectedStop) {
                                        if (!isFavorite && favoriteStops.length >= 20) {
                                            toast.error(t('toasts.favoritesLimitReached'));
                                            return;
                                        }
                                        toggleFavorite(selectedStop.stop_id);
                                    }
                                }}
                                className={cn(
                                    "h-7 w-7 flex items-center justify-center rounded-md transition-all text-muted-foreground opacity-40 hover:opacity-100 hover:text-amber-500",
                                    isFavorite && "text-amber-500 opacity-100"
                                )}
                            >
                                <Star size={16} fill={isFavorite ? 'currentColor' : 'none'}  strokeWidth={1.5} />
                            </button>
                        } />
                        <TooltipContent side="bottom" className="text-[11px] px-2 py-1">
                            {isFavorite ? t('map.departures.removeFromFavorites') : t('map.departures.addToFavorites')}
                        </TooltipContent>
                    </Tooltip>

                    {/* Share */}
                    <Tooltip>
                        <TooltipTrigger render={
                            <button
                                onClick={handleShare}
                                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors text-muted-foreground opacity-40 hover:opacity-100 hover:text-foreground"
                            >
                                <Share2 size={16}  strokeWidth={1.5} />
                            </button>
                        } />
                        <TooltipContent side="bottom" className="text-[11px] px-2 py-1">
                            {t('common.share')}
                        </TooltipContent>
                    </Tooltip>
                </HStack>
            </HStack>

            {/* Row 2: Line badges */}
            {selectedStop?.lines && selectedStop.lines.length > 0 && (
                <div 
                    className="w-full overflow-x-auto no-scrollbar py-2 px-2"
                    style={{ 
                        maskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)'
                    }}
                >
                    <HStack gap={1.5} justify="start">
                        {uniqueLines.map((line) => {
                            const name = String(line.name || '');
                            if (!name) return null;

                            const isActive = selectedLine === name;
                            const isDimmed = !!selectedLine && !isActive;
                            const isMetro = line.type === '1' || ['A', 'B', 'C'].includes(name);

                            return (
                                <button 
                                    key={name}
                                    onClick={() => toggleLineFilter(name)}
                                    className={cn(
                                        "transition-all active:scale-95 select-none shadow-sm cursor-pointer hover:brightness-110",
                                        isDimmed ? "opacity-30 scale-95" : "opacity-100",
                                        isActive && "ring-2 ring-white z-10 shadow-lg rounded-[4px]"
                                    )}
                                >
                                    {isMetro ? (
                                        <LineBadge name={name} routeColor={line.route_color || FALLBACK_ROUTE_COLOR} size="lg" />
                                    ) : (
                                        <LineBadge name={name} routeColor={line.route_color || FALLBACK_ROUTE_COLOR} size="lg" />
                                    )}
                                </button>
                            );
                        })}
                        <div className="shrink-0 w-8 h-1" />
                    </HStack>
                </div>
            )}
        </div>
    );
});

DepartureBoardHeader.displayName = 'DepartureBoardHeader';
