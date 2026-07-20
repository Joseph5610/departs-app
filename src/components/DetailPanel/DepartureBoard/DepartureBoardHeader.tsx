import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownAz, Clock, Star, MapPin, Share2, Activity, ExternalLink, Footprints, MoreHorizontal, MessageSquareHeart, Snowflake, ArrowUpDown } from 'lucide-react';
import { FALLBACK_ROUTE_COLOR } from '../../../config/constants';
import { useSelectionStore } from '../../../state/selectionStore';
import { usePreferencesStore } from '../../../state/preferencesStore';
import { useShare } from '../../../hooks/features/useShare';
import { useSelectedStop } from '../../../hooks/derived/useSelectedStop';
import { useSelectedVehicle } from '../../../hooks/derived/useSelectedVehicle';
import { useDepartures } from '../../../hooks/data/useDepartures';
import { useCities } from '../../../hooks/data/useCities';
import { useNavigate } from '../../../hooks/features/useNavigate';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
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

    // Preferences
    const departureSort = usePreferencesStore(s => s.departureSort);
    const favoriteStops = usePreferencesStore(s => s.favoriteStops);
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const requireAirConditioned = usePreferencesStore(s => s.requireAirConditioned);
    const { setDepartureSort, toggleFavorite, setIsFeedbackOpen, toggleRequireAirConditioned } = usePreferencesStore(s => s.actions);

    const { share } = useShare();
    const selectedLine = useSelectionStore(s => s.selectedLine);
    const { toggleLineFilter } = useSelectionStore(s => s.actions);

    const isMobile = useIsMobile();

    // Selection
    
    // Derived state
    const selectedStop = useSelectedStop();
    const selectedVehicle = useSelectedVehicle();

    const { handleNavigate, distanceLabel, stopDistanceInfo } = useNavigate();
    const { delayStats, isError, hasAirConditioningData } = useDepartures();

    const { data: citiesData } = useCities();
    const currentCityConfig = citiesData?.cities.find(c => c.slug === selectedCity);
    const virtualTableUrl = currentCityConfig?.virtualTableUrl;

    const showHeader = !!selectedStop && !selectedVehicle && !isError;
    const isFavorite = selectedStop ? favoriteStops.includes(selectedStop.stop_id) : false;

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
            <div className="flex w-full h-7 justify-between items-center">
                <div className="flex gap-2 shrink-0 items-center">
                    <div className="flex items-center h-7 rounded-full bg-card border border-border/50 shadow-sm shrink-0 overflow-hidden">
                        {/* Distance & Walking Time segment */}
                        <div 
                            className="flex items-center h-full px-3 hover:bg-muted active:bg-muted/80 transition-colors cursor-pointer"
                            onClick={handleNavigate}
                        >
                             <MapPin size={12} className="text-muted-foreground/80 mr-1"  strokeWidth={1.5} />
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
                                <div className="w-px h-3 bg-border shrink-0" />
                                <Popover>
                                    <PopoverTrigger render={<Button variant="ghost" className="h-7 px-3 gap-1 rounded-md transition-colors hover:bg-muted active:scale-95" />}>
                                        <Activity size={12} className={cn(
                                            delayStats.trend === 'worsening' ? "text-red-400" :
                                            delayStats.trend === 'improving' ? "text-emerald-400" :
                                            "text-amber-400"
                                        )} strokeWidth={1.5} />
                                        <span className="font-bold text-foreground text-[11px] tracking-tight opacity-90 whitespace-nowrap">
                                            {delayStats.averageDelayMin === 0 
                                                ? t('map.departures.onTime') 
                                                : `~${delayStats.averageDelayMin > 0 ? '+' : ''}${delayStats.averageDelayMin} min`}
                                        </span>
                                    </PopoverTrigger>
                                    <PopoverContent side="bottom" align="center" className="w-auto border bg-popover/95 backdrop-blur-xl shadow-2xl">
                                        <span className="text-[13px] font-medium text-foreground/90">
                                            {t('map.departures.delayStatsTooltip', { count: delayStats.sampleSize })}
                                        </span>
                                    </PopoverContent>
                                </Popover>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex gap-1 shrink-0 items-center pr-1">
                    {/* Sort Action */}
                    <DropdownMenu>
                        <Tooltip>
                            <TooltipTrigger render={
                                <DropdownMenuTrigger render={
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        className="text-muted-foreground"
                                    >
                                        <ArrowUpDown size={16} strokeWidth={1.5} />
                                    </Button>
                                } />
                            } />
                            <TooltipContent side="bottom" className="text-[11px] px-2 py-1">
                                {t('map.departures.sort')}
                            </TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuRadioGroup value={departureSort} onValueChange={(value) => setDepartureSort(value as 'line' | 'departure')}>
                                <DropdownMenuRadioItem value="departure" className="flex items-center gap-2">
                                    <Clock size={14} strokeWidth={1.5} className="mr-1 text-muted-foreground" />
                                    <span>{t('map.departures.sortByDeparture')}</span>
                                </DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="line" className="flex items-center gap-2">
                                    <ArrowDownAz size={14} strokeWidth={1.5} className="mr-1 text-muted-foreground" />
                                    <span>{t('map.departures.sortByLine')}</span>
                                </DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Favorite */}
                    <Tooltip>
                        <TooltipTrigger render={
                            <Button
                                variant="ghost"
                                size="icon-xs"
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
                                    "text-muted-foreground",
                                    isFavorite && "text-amber-500 hover:text-amber-400"
                                )}
                            >
                                <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} strokeWidth={1.5} />
                            </Button>
                        } />
                        <TooltipContent side="bottom" className="text-[11px] px-2 py-1">
                            {isFavorite ? t('map.departures.removeFromFavorites') : t('map.departures.addToFavorites')}
                        </TooltipContent>
                    </Tooltip>

                    {/* Desktop Dropdown or Mobile Share */}
                    {!isMobile ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger render={
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    data-testid="more-options-btn"
                                    aria-label="More options"
                                    className="text-muted-foreground"
                                >
                                    <MoreHorizontal size={16} strokeWidth={1.5} />
                                </Button>
                            } />
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem render={<div data-testid="share-btn" onClick={handleShare} />} closeOnClick={false}>
                                    <Share2 size={14} className="mr-2" strokeWidth={1.5} />
                                    {t('common.share')}
                                </DropdownMenuItem>
                                <DropdownMenuItem render={<div onClick={() => setIsFeedbackOpen(true)} />}>
                                    <MessageSquareHeart size={14} className="mr-2" strokeWidth={1.5} />
                                    {t('feedback.title')}
                                </DropdownMenuItem>
                                {virtualTableUrl && selectedStop && (
                                    <DropdownMenuItem render={<a href={`${virtualTableUrl}${selectedStop.stop_id.replace(/,/g, ';')}&title=${encodeURIComponent(selectedStop.stop_name || '')}`} target="_blank" rel="noopener noreferrer" className="cursor-pointer" />}>
                                        <ExternalLink size={14} className="mr-2" strokeWidth={1.5} />
                                        {t('map.departures.officialBoard')}
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <Tooltip>
                            <TooltipTrigger render={
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={handleShare}
                                    data-testid="share-btn"
                                    aria-label={t('common.share')}
                                    className="text-muted-foreground"
                                >
                                    <Share2 size={16} strokeWidth={1.5} />
                                </Button>
                            } />
                            <TooltipContent side="bottom" className="text-[11px] px-2 py-1">
                                {t('common.share')}
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>
            </div>

            {/* Row 2: Line badges and AC filter */}
            {((selectedStop?.lines && selectedStop.lines.length > 0) || hasAirConditioningData) && (
                <div 
                    className="w-full overflow-x-auto no-scrollbar py-2 px-2"
                    style={{ 
                        maskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent 100%)'
                    }}
                >
                    <div className="flex gap-1.5 justify-start">
                        {hasAirConditioningData && (
                            <button
                                onClick={toggleRequireAirConditioned}
                                className={cn(
                                    "flex items-center justify-center h-[24px] px-1.5 transition-all active:scale-95 select-none shadow-sm cursor-pointer hover:brightness-110 rounded-[4px] border border-border/50 text-[11px] font-bold gap-1 shrink-0",
                                    requireAirConditioned ? "bg-[#0ea5e9] text-white ring-[2.5px] ring-foreground z-10 shadow-lg" : "bg-secondary text-secondary-foreground"
                                )}
                            >
                                <Snowflake size={12} strokeWidth={2.5} className={cn(!requireAirConditioned && "opacity-70")} />
                                <span>{t('map.vehicleDetails.ac')}</span>
                            </button>
                        )}
                        
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
                                        "flex transition-all active:scale-95 select-none shadow-sm cursor-pointer hover:brightness-110",
                                        isDimmed ? "opacity-30" : "opacity-100",
                                        isActive && "ring-[2.5px] ring-foreground z-10 shadow-lg rounded-[4px]"
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
                    </div>
                </div>
            )}
        </div>
    );
});

DepartureBoardHeader.displayName = 'DepartureBoardHeader';
