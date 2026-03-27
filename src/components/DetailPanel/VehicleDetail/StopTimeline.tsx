import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Box, Stack, HStack } from '@/components/ui/layout';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import type { StopFeature, StopTimelineProps } from './types';

/**
 * StopTimeline
 *
 * Renders the collapsible stop list with past/future split.
 * Extracted from VehicleDetail to reduce monolith size.
 * The timeline visually shows a vertical line with dots for each stop.
 */
export const StopTimeline: React.FC<StopTimelineProps> = ({ stopTimes, effectiveSequence }) => {
    const { t } = useTranslation();
    const [showPastStops, setShowPastStops] = useState(false);

    const nextStopSequence = useMemo(() => {
        if (effectiveSequence === null) return null;
        const futureStops = stopTimes
            .filter((s) => Number(s.properties.stop_sequence) > (effectiveSequence ?? 0))
            .sort((a, b) => Number(a.properties.stop_sequence) - Number(b.properties.stop_sequence));
        return futureStops.length > 0 ? Number(futureStops[0].properties.stop_sequence) : null;
    }, [stopTimes, effectiveSequence]);

    if (!stopTimes.length) return null;

    return (
        <Collapsible open={showPastStops} onOpenChange={setShowPastStops}>
            <Stack gap={3}>
                <HStack justify="between" className="px-1">
                    <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest">{t('map.vehicleDetails.routeSchedule')}</span>
                    {effectiveSequence !== null && (
                        <CollapsibleTrigger render={
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 rounded-xl text-[10px] bg-transparent hover:bg-muted/50 text-muted-foreground hover:text-foreground font-bold uppercase tracking-wider px-2 gap-1.5"
                            />
                        }>
                            {showPastStops ? t('map.vehicleDetails.hidePastStops') : t('map.vehicleDetails.showPastStops')}
                            {showPastStops ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </CollapsibleTrigger>
                    )}
                </HStack>
                <Box className="relative pl-6 overflow-hidden!">
                    <Box className="absolute left-[11px] top-3 bottom-6 w-0.5 bg-border" />

                    {/* Past Stops (Collapsible) */}
                    <CollapsibleContent className="transition-[height] duration-300 ease-in-out data-[state=closed]:overflow-hidden data-[state=open]:overflow-visible">
                        {stopTimes
                            .filter(stop => Number(stop.properties.stop_sequence) < (effectiveSequence ?? 0))
                            .map((stop, idx: number) => (
                                <StopItem
                                    key={`past-${idx}`}
                                    stop={stop}
                                    isPast={true}
                                    effectiveSequence={effectiveSequence}
                                    nextStopSequence={nextStopSequence}
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
                            />
                        ))
                    }
                </Box>
            </Stack>
        </Collapsible>
    );
};

StopTimeline.displayName = 'StopTimeline';

const StopItem = ({ stop, isPast, effectiveSequence, nextStopSequence }: {
    stop: StopFeature,
    isPast: boolean,
    effectiveSequence: number | null,
    nextStopSequence: number | null
}) => {
    const { t } = useTranslation();
    const stopSeq = Number(stop.properties.stop_sequence);
    const isCurrent = stopSeq === effectiveSequence;
    const isNext = stopSeq === nextStopSequence;
    const showZone = !!stop.properties.zone_id;

    return (
        <HStack justify="between" className={cn(
            "relative py-2.5 transition-opacity",
            isPast ? "opacity-40" : "opacity-100"
        )}>
            <Box className={cn(
                "absolute -left-[17px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full z-10 shadow-md",
                isCurrent ? "bg-primary ring-[5px] ring-primary/20" : isPast ? "bg-foreground/20" : "bg-foreground/50"
            )} />
            <Stack align="start" gap={0} className="min-w-0 pr-2 flex-1">
                <span className={cn(
                    "text-sm line-clamp-2 w-full leading-snug",
                    isCurrent ? "text-primary font-bold" : isNext ? "text-foreground font-bold" : isPast ? "text-muted-foreground" : "text-foreground font-medium"
                )}>
                    {stop.properties.stop_name}
                </span>
                <HStack gap={2} align="center" className="flex-wrap">
                    {isCurrent && <span className="text-[10px] text-primary font-bold uppercase tracking-wider">{t('map.vehicleDetails.currentStop')}</span>}
                    {isNext && <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{t('map.vehicleDetails.nextStop')}</span>}
                </HStack>
            </Stack>
            <Box className="shrink-0 w-8 flex justify-center">
                {showZone && (
                    <span className="text-[10px] text-muted-foreground/60 font-bold bg-muted/30 px-1.5 py-0.5 rounded-md border border-border/50 tabular-nums">
                        {stop.properties.zone_id}
                    </span>
                )}
            </Box>
            <Stack align="end" gap={0} className="shrink-0 min-w-[64px]">
                {(() => {
                    const { realtime_arrival_time, arrival_time } = stop.properties;
                    const realtimeTime = realtime_arrival_time || arrival_time;
                    const scheduledTime = arrival_time;
                    const hasRealtime = !!realtime_arrival_time && realtime_arrival_time !== arrival_time;
                    const isEarly = hasRealtime && realtime_arrival_time < arrival_time;
                    const isLate = hasRealtime && realtime_arrival_time > arrival_time;
                    return (
                        <>
                            <span className={cn(
                                "text-xs tabular-nums",
                                isPast ? "text-muted-foreground" : isEarly ? "text-primary" : isLate ? "text-destructive" : "text-muted-foreground"
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
            </Stack>
        </HStack>
    );
};
