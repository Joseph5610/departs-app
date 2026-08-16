import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Hand } from 'lucide-react';
import { navigate } from 'wouter/use-browser-location';
import { cn } from '@/lib/utils';
import { calculateTimeDifferenceSecs, addSecondsToTime } from '../../../utils/dateUtils';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { LineBadge } from '../../LineBadge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePreferencesStore } from '../../../state/preferencesStore';

import type { StopFeature, StopTimelineProps } from './types';

/**
 * StopTimeline
 *
 * Renders the collapsible stop list with past/future split.
 * Extracted from VehicleDetail to reduce monolith size.
 * The timeline visually shows a vertical line with dots for each stop.
 */
export const StopTimeline: React.FC<StopTimelineProps> = ({ stopTimes, effectiveSequence, delay }) => {
    const { t } = useTranslation();
    const [showPastStops, setShowPastStops] = useState(false);

    const nextStopSequence = useMemo(() => {
        if (effectiveSequence === null) return null;
        const futureStops = stopTimes
            .filter((s) => Number(s.properties.stop_sequence) > (effectiveSequence ?? 0))
            .sort((a, b) => Number(a.properties.stop_sequence) - Number(b.properties.stop_sequence));
        return futureStops.length > 0 ? Number(futureStops[0].properties.stop_sequence) : null;
    }, [stopTimes, effectiveSequence]);

    const pastStopsCount = useMemo(() => {
        if (effectiveSequence === null) return 0;
        return stopTimes.filter((s) => Number(s.properties.stop_sequence) < effectiveSequence).length;
    }, [stopTimes, effectiveSequence]);

    if (!stopTimes.length) return null;

    return (
        <Collapsible open={showPastStops} onOpenChange={setShowPastStops}>
            <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center px-1">
                    <span className="micro-label-widest text-muted-foreground">{t('map.vehicleDetails.routeSchedule')}</span>
                    {effectiveSequence !== null && pastStopsCount > 0 && (
                        <CollapsibleTrigger render={
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 rounded-xl micro-label bg-foreground/5 border border-border/50 hover:bg-foreground/10 text-muted-foreground hover:text-foreground px-3 gap-1.5"
                            />
                        }>
                            {showPastStops ? t('map.vehicleDetails.hidePastStops') : t('map.vehicleDetails.showPastStops')}
                            {showPastStops ? <ChevronUp size={14}  strokeWidth={1.5} /> : <ChevronDown size={14}  strokeWidth={1.5} />}
                        </CollapsibleTrigger>
                    )}
                </div>
                <div className="relative pl-6 overflow-hidden!">
                    <div className="absolute left-2.75 top-3 bottom-6 w-0.5 bg-border" />

                    {/* Past Stops (Collapsible) */}
                    <CollapsibleContent className="animate-in fade-in-0 slide-in-from-top-1 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-1 data-[state=closed]:overflow-hidden data-[state=open]:overflow-visible">
                        {stopTimes
                            .filter(stop => Number(stop.properties.stop_sequence) < (effectiveSequence ?? 0))
                            .map((stop, idx: number) => (
                                <StopItem
                                    key={`past-${idx}`}
                                    stop={stop}
                                    isPast={true}
                                    effectiveSequence={effectiveSequence}
                                    nextStopSequence={nextStopSequence}
                                    delay={delay}
                                />
                            ))
                        }
                    </CollapsibleContent>

                    {/* Current & Future Stops */}
                    {stopTimes
                        .filter(stop => Number(stop.properties.stop_sequence) >= (effectiveSequence ?? 0))
                        .map((stop, idx: number) => (
                            <StopItem
                                key={`future-${idx}`}
                                stop={stop}
                                isPast={false}
                                effectiveSequence={effectiveSequence}
                                nextStopSequence={nextStopSequence}
                                delay={delay}
                            />
                        ))
                    }
                </div>
            </div>
        </Collapsible>
    );
};

StopTimeline.displayName = 'StopTimeline';

const StopItem = ({ stop, isPast, effectiveSequence, nextStopSequence, delay }: {
    stop: StopFeature,
    isPast: boolean,
    effectiveSequence: number | null,
    nextStopSequence: number | null,
    delay?: number | null
}) => {
    const { t } = useTranslation();
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const stopSeq = Number(stop.properties.stop_sequence);
    const isCurrent = stopSeq === effectiveSequence;
    const isNext = stopSeq === nextStopSequence;
    const showZone = !!stop.properties.zone_id;

    const rawStopId = stop.properties.stop_id ? String(stop.properties.stop_id) : '';
    const hasValidStopId = Boolean(rawStopId) && !rawStopId.startsWith('incomplete-gap');

    if (rawStopId.startsWith('incomplete-gap')) {
        return (
            <div className="flex items-center relative py-2 opacity-50">
                <div className="absolute -left-3.75 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-foreground/30 z-10" />
                <div className="flex-1 pl-2">
                    <span className="text-xs text-muted-foreground italic">...</span>
                </div>
            </div>
        );
    }

    const handleStopClick = () => {
        if (hasValidStopId) {
            navigate(`/${selectedCity}/stop/${encodeURIComponent(rawStopId)}`);
        }
    };

    return (
        <div className={cn(
            "flex justify-between items-center relative py-2.5 transition-opacity",
            isPast ? "opacity-40" : "opacity-100"
        )}>
            <div className={cn(
                "absolute -left-4.25 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full z-10 shadow-md",
                isCurrent ? "bg-primary ring-[5px] ring-primary/20" : isPast ? "bg-foreground/20" : "bg-foreground/50"
            )} />
            <div className="flex flex-col items-start min-w-0 pr-2 flex-1">
                <div className="flex items-center gap-1.5 w-full">
                    {hasValidStopId ? (
                        <button
                            type="button"
                            onClick={handleStopClick}
                            aria-label={t('map.vehicleDetails.viewStopDepartures', { stopName: stop.properties.stop_name, defaultValue: `View departures for ${stop.properties.stop_name}` })}
                            className={cn(
                                "text-sm truncate min-w-0 text-left cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-xs hover:underline hover:text-primary active:opacity-80",
                                isCurrent ? "text-primary font-bold" : isNext ? "text-foreground font-bold" : isPast ? "text-muted-foreground" : "text-foreground font-medium"
                            )}
                        >
                            {stop.properties.stop_name}
                        </button>
                    ) : (
                        <span className={cn(
                            "text-sm truncate min-w-0",
                            isCurrent ? "text-primary font-bold" : isNext ? "text-foreground font-bold" : isPast ? "text-muted-foreground" : "text-foreground font-medium"
                        )}>
                            {stop.properties.stop_name}
                        </span>
                    )}
                    {stop.properties.is_request_stop && (
                        <Popover>
                            <PopoverTrigger className="flex items-center text-muted-foreground shrink-0 cursor-pointer outline-none hover:text-foreground transition-colors">
                                <Hand size={14} strokeWidth={1.5} />
                            </PopoverTrigger>
                            <PopoverContent side="top" className="w-auto px-3 py-1.5 min-w-30 text-center">
                                <span className="text-sm font-medium">{t('map.vehicleDetails.requestStop', 'Request Stop')}</span>
                            </PopoverContent>
                        </Popover>
                    )}
                    <div className="flex gap-1 shrink-0 translate-y-px">
                        {stop.properties.metro_lines?.map((line) => (
                            <LineBadge key={line.name} name={line.name} routeColor={line.route_color} />
                        ))}
                    </div>
                </div>
                <div className="flex gap-2 items-center flex-wrap mt-0.5">
                    {isCurrent && <span className="micro-label text-primary">{t('map.vehicleDetails.currentStop')}</span>}
                    {isNext && <span className="micro-label text-muted-foreground">{t('map.vehicleDetails.nextStop')}</span>}
                </div>
            </div>
            <div className="shrink-0 w-8 flex justify-center items-center">
                {showZone && (
                    <span className="text-[10px] text-muted-foreground/60 font-bold bg-muted/30 px-1.5 py-0.5 rounded-md border border-border/50 leading-none tabular-nums">
                        {stop.properties.zone_id}
                    </span>
                )}
            </div>
            <div className="flex flex-col items-end shrink-0 min-w-16">
                {(() => {
                    const { realtime_arrival_time, realtime_departure_time, arrival_time, departure_time } = stop.properties;
                    
                    const rtTime = (isPast || isCurrent) 
                        ? (realtime_departure_time || realtime_arrival_time) 
                        : (realtime_arrival_time || realtime_departure_time);
                        
                    const schTime = (isPast || isCurrent) 
                        ? (departure_time || arrival_time) 
                        : (arrival_time || departure_time);
                        
                    let realtimeTime = rtTime || schTime;
                    const scheduledTime = schTime;
                    
                    // Always augment with vehicle delay for current/future stops if a delay exists.
                    // This overrides the backend's rtTime which may be incorrectly identical to schTime.
                    if (schTime && typeof delay === 'number' && !isPast) {
                        realtimeTime = addSecondsToTime(schTime as string, delay);
                    }
                    
                    const hasRealtime = (!!rtTime && rtTime !== schTime) || (!!schTime && !!delay && delay !== 0 && !isPast);
                    
                    let isLate = false;
                    
                    if (hasRealtime && schTime && realtimeTime) {
                        const diff = calculateTimeDifferenceSecs(realtimeTime as string, schTime as string);
                        isLate = diff > 30;
                    }
                    return (
                        <>
                            <span className={cn(
                                "text-xs tabular-nums",
                                isPast ? "text-muted-foreground" : hasRealtime ? (isLate ? "text-destructive" : "text-primary") : "text-muted-foreground"
                            )}>
                                {String(realtimeTime || '').slice(0, 8)}
                            </span>
                            {hasRealtime && (
                                <span className="text-[9px] text-muted-foreground tabular-nums">
                                    {t('map.vehicleDetails.scheduledTime')} {String(scheduledTime || '').slice(0, 8)}
                                </span>
                            )}
                        </>
                    );
                })()}
            </div>
        </div>
    );
};
