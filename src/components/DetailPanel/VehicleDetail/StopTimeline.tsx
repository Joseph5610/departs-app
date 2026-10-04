import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { StopTimelineItem } from './StopTimelineItem';
import { StopConnections, StopContinuation } from './StopTransfers';
import type { StopFeature, StopTimelineProps } from './types';

/** The trip's stops on a vertical line, with past stops collapsed behind a toggle. */
export const StopTimeline: React.FC<StopTimelineProps> = ({ stopTimes, routeName, effectiveSequence, delay }) => {
    const { t } = useTranslation();
    const [showPastStops, setShowPastStops] = useState(false);

    const nextStopSequence = useMemo(() => {
        if (effectiveSequence === null) return null;
        const futureStops = stopTimes
            .filter((s) => Number(s.properties.stop_sequence) > (effectiveSequence ?? 0))
            .sort((a, b) => Number(a.properties.stop_sequence) - Number(b.properties.stop_sequence));
        return futureStops.length > 0 ? Number(futureStops[0].properties.stop_sequence) : null;
    }, [stopTimes, effectiveSequence]);

    /** Only the first upcoming stop with transfers starts expanded, so long lists stay scannable. */
    const firstTransferSequence = useMemo(() => {
        const first = stopTimes.find((s) =>
            Number(s.properties.stop_sequence) >= (effectiveSequence ?? 0) && !!s.properties.connections?.length
        );
        return first ? Number(first.properties.stop_sequence) : null;
    }, [stopTimes, effectiveSequence]);

    const pastStopsCount = useMemo(() => {
        if (effectiveSequence === null) return 0;
        return stopTimes.filter((s) => Number(s.properties.stop_sequence) < effectiveSequence).length;
    }, [stopTimes, effectiveSequence]);

    /** The line must stop at the last dot, not run behind that stop's own transfer card. */
    const lastStop = useMemo(() => {
        return stopTimes.reduce<StopFeature | null>((last, s) => {
            if (!last) return s;
            return Number(s.properties.stop_sequence) > Number(last.properties.stop_sequence) ? s : last;
        }, null);
    }, [stopTimes]);
    const lastStopSequence = lastStop ? Number(lastStop.properties.stop_sequence) : null;
    const lastStopIsPast = lastStopSequence !== null && effectiveSequence !== null && lastStopSequence < effectiveSequence;

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
                <div>
                    <div className="relative pl-6 overflow-hidden!">
                        <div className={cn(
                            "absolute left-2.75 bottom-6 w-0.5 bg-border",
                            (pastStopsCount === 0 || showPastStops) ? "top-6" : "top-0"
                        )} />

                        <CollapsibleContent className="animate-in fade-in-0 slide-in-from-top-1 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-1 data-[state=closed]:overflow-hidden data-[state=open]:overflow-visible">
                            {stopTimes
                                .filter(stop => Number(stop.properties.stop_sequence) < (effectiveSequence ?? 0))
                                .map((stop, idx: number) => (
                                    <StopTimelineItem
                                        key={`past-${stop.properties.stop_sequence || idx}`}
                                        stop={stop}
                                        routeName={routeName}
                                        isPast={true}
                                        effectiveSequence={effectiveSequence}
                                        nextStopSequence={nextStopSequence}
                                        delay={delay}
                                        isFirstTransfer={false}
                                        isLastStop={false}
                                    />
                                ))
                            }
                        </CollapsibleContent>

                        {stopTimes
                            .filter(stop => Number(stop.properties.stop_sequence) >= (effectiveSequence ?? 0))
                            .map((stop, idx: number) => (
                                <StopTimelineItem
                                    key={`future-${stop.properties.stop_sequence || idx}`}
                                    stop={stop}
                                    routeName={routeName}
                                    isPast={false}
                                    effectiveSequence={effectiveSequence}
                                    nextStopSequence={nextStopSequence}
                                    delay={delay}
                                    isFirstTransfer={Number(stop.properties.stop_sequence) === firstTransferSequence}
                                    isLastStop={Number(stop.properties.stop_sequence) === lastStopSequence}
                                />
                            ))
                        }
                    </div>

                    {/* The last stop's own transfers render outside the line's gutter so the line ends at its dot. */}
                    {lastStop && (lastStop.properties.connections || lastStop.properties.continues_as) && (
                        <div className="pl-6">
                            {lastStop.properties.connections && (
                                <StopConnections
                                    connections={lastStop.properties.connections}
                                    isPast={lastStopIsPast}
                                    defaultOpen={Number(lastStop.properties.stop_sequence) === firstTransferSequence}
                                />
                            )}
                            {lastStop.properties.continues_as && (
                                <StopContinuation continuation={lastStop.properties.continues_as} isPast={lastStopIsPast} />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Collapsible>
    );
};

StopTimeline.displayName = 'StopTimeline';
