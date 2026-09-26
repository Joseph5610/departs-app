import React from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Activity, Footprints, Snowflake } from 'lucide-react';
import { FALLBACK_ROUTE_COLOR } from '../../../config/constants';
import { useSelectionStore } from '../../../state/selectionStore';
import { usePreferencesStore } from '../../../state/preferencesStore';
import { useSelectedStop } from '../../../hooks/derived/useSelectedStop';
import { useSelectedVehicle } from '../../../hooks/derived/useSelectedVehicle';
import { useDepartures } from '../../../hooks/data/useDepartures';
import { useCityConfig, useLineRules } from '../../../hooks/data/useCities';
import { ROUTE_TYPE_ORDER, routeTypeRank } from '../../../config/transit';
import { useNavigate } from '../../../hooks/features/useNavigate';
import { formatStopDistance } from '../../../hooks/derived/useStopDistance';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { LineBadge } from '../../LineBadge';

/**
 * DepartureBoardHeader
 * 
 * Sticky subheader for the departure board.
 * Compact 2-row layout:
 *   Row 1: [Distance pill] [Delay indicator] [PID link]
 *   Row 2: [Line badges ...]
 */
export const DepartureBoardHeader = React.memo(() => {
    const { t } = useTranslation();

    // Preferences
    const requireAirConditioned = usePreferencesStore(s => s.requireAirConditioned);
    const { toggleRequireAirConditioned } = usePreferencesStore(s => s.actions);

    const selectedLine = useSelectionStore(s => s.selectedLine);
    const { toggleLineFilter } = useSelectionStore(s => s.actions);


    // Selection
    
    // Derived state
    const selectedStop = useSelectedStop();
    const selectedVehicle = useSelectedVehicle();

    const { handleNavigate, stopDistanceInfo } = useNavigate();
    const { data: departuresData, delayStats, isError, hasAirConditioningData } = useDepartures();

    const { lineChipsFromDepartures } = useCityConfig();
    const lineRules = useLineRules();

    const showHeader = !!selectedStop && !selectedVehicle && !isError;

    const uniqueLines = React.useMemo(() => {
        const source = lineChipsFromDepartures
            ? departuresData?.departures.map(dep => ({ name: dep.line, type: dep.type, route_color: dep.route_color ?? '' }))
            : selectedStop?.lines;
        if (!source) return [];
        const seen = new Set<string>();
        const lines = source.filter(line => {
            if (seen.has(line.name)) return false;
            seen.add(line.name);
            return true;
        });

        const getLineGroup = (line: { name: string, type: string }) => {
            const name = line.name.toUpperCase();
            if (line.type === 'metro' || lineRules.metroLineNames.includes(name)) return routeTypeRank('metro');
            if (line.type === 'train' || lineRules.trainLinePrefixes.some(prefix => name.startsWith(prefix))) return routeTypeRank('train');
            const rank = routeTypeRank(line.type);
            return lineRules.isNightLine(line.type, name) ? rank + ROUTE_TYPE_ORDER.length + 1 : rank;
        };

        return lines.sort((a, b) => {
            const groupA = getLineGroup(a);
            const groupB = getLineGroup(b);
            if (groupA !== groupB) return groupA - groupB;
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        });
    }, [selectedStop, lineRules, lineChipsFromDepartures, departuresData]);

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
                            onClick={() => handleNavigate()}
                        >
                             <MapPin size={12} className="text-muted-foreground/80 mr-1"  strokeWidth={1.5} />
                             <span className="font-bold text-foreground text-[11px] tracking-tight whitespace-nowrap flex items-center">
                                {stopDistanceInfo?.isReasonableWalkingDistance ? (
                                    <>
                                        <span>{t('map.departures.meters', { distance: stopDistanceInfo.distance })}</span>
                                        <span className="mx-1.5 opacity-30 font-normal">•</span>
                                        <Footprints size={14} className="mr-1 text-muted-foreground/60"  strokeWidth={1.5} />
                                        <span>{t('map.departures.minutes', { count: stopDistanceInfo.time })}</span>
                                    </>
                                ) : (
                                    stopDistanceInfo ? formatStopDistance(stopDistanceInfo, t) : t('map.departures.openInMaps')
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
                                            delayStats.trend === 'worsening' ? "text-destructive" :
                                            delayStats.trend === 'improving' ? "text-emerald-400" :
                                            "text-amber-400"
                                        )} strokeWidth={1.5} />
                                        <span className="font-bold text-foreground text-[11px] tracking-tight opacity-90 whitespace-nowrap">
                                            {delayStats.averageDelayMin === 0 
                                                ? t('map.departures.onTime') 
                                                : `~${delayStats.averageDelayMin > 0 ? '+' : ''}${t('map.departures.minutes', { count: delayStats.averageDelayMin })}`}
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
            </div>

            {/* Row 2: Line badges and AC filter */}
            {(uniqueLines.length > 0 || hasAirConditioningData) && (
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
                                    "flex items-center justify-center h-6 px-2 transition-[transform,colors] active:scale-95 select-none shadow-sm cursor-pointer hover:brightness-110 rounded-md border border-border/50 text-[11px] font-bold gap-1 shrink-0",
                                    requireAirConditioned ? "bg-sky-500 text-white z-10 shadow-lg border-transparent" : "bg-secondary text-secondary-foreground"
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

                            return (
                                <button 
                                    key={name}
                                    onClick={() => toggleLineFilter(name)}
                                    className={cn(
                                        "flex transition-[transform,opacity] active:scale-95 select-none cursor-pointer hover:brightness-110 rounded-md",
                                        isDimmed ? "opacity-30" : "opacity-100",
                                        isActive && "z-10 ring-2 ring-primary/40"
                                    )}
                                >
                                    <LineBadge name={name} routeColor={line.route_color || FALLBACK_ROUTE_COLOR} size="lg" />
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
