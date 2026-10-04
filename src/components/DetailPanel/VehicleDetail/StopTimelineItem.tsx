import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Hand } from 'lucide-react';
import { navigate } from '../../../lib/history';
import { paths } from '../../../lib/routes';
import { cn } from 'cn';
import { addSecondsToTime } from '../../../utils/dateUtils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePreferencesStore } from '../../../state/preferencesStore';
import { useInterchanges } from '../../../hooks/derived/useInterchanges';
import { InterchangeBadges } from '../../InterchangeBadges';
import { TimelineTime } from './TimelineTime';
import { StopConnections, StopContinuation } from './StopTransfers';
import type { StopFeature } from './types';

/** The stop's expected and scheduled time; the vehicle's live delay overrides the backend's realtime time for upcoming stops. */
const stopTimes = (stop: StopFeature, isPast: boolean, isCurrent: boolean, isLastStop: boolean, delay: number | null | undefined) => {
    const { realtime_arrival_time, realtime_departure_time, arrival_time, departure_time } = stop.properties;

    // A terminus departure is the vehicle's layover until its next run (KORDIS trains: hours later).
    const showsDeparture = (isPast || isCurrent) && !isLastStop;
    const rtTime = showsDeparture
        ? (realtime_departure_time || realtime_arrival_time)
        : (realtime_arrival_time || realtime_departure_time);
    const schTime = showsDeparture
        ? (departure_time || arrival_time)
        : (arrival_time || departure_time);

    const realtimeTime = schTime && typeof delay === 'number' && !isPast
        ? addSecondsToTime(schTime, delay)
        : rtTime || schTime;
    const hasRealtime = (!!rtTime && rtTime !== schTime) || (!!schTime && !!delay && delay !== 0 && !isPast);

    return { realtimeTime, scheduledTime: schTime, hasRealtime };
};

export const StopTimelineItem = React.memo(({ stop, routeName, isPast, effectiveSequence, nextStopSequence, delay, isFirstTransfer, isLastStop }: {
    stop: StopFeature,
    routeName: string,
    isPast: boolean,
    effectiveSequence: number | null,
    nextStopSequence: number | null,
    delay?: number | null,
    isFirstTransfer: boolean,
    /** The line's own last stop; its transfer card is rendered outside the line's gutter instead. */
    isLastStop: boolean
}) => {
    const { t } = useTranslation();
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { forStop } = useInterchanges();
    const stopSeq = Number(stop.properties.stop_sequence);
    const isCurrent = stopSeq === effectiveSequence;
    const isNext = stopSeq === nextStopSequence;
    const showZone = !!stop.properties.zone_id;

    const rawStopId = stop.properties.stop_id ? String(stop.properties.stop_id) : '';

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

    const nameClass = isCurrent ? "text-primary font-bold" : isNext ? "text-foreground font-bold" : isPast ? "text-muted-foreground" : "text-foreground font-medium";
    const time = stopTimes(stop, isPast, isCurrent, isLastStop, delay);

    return (
        <>
            <div className={cn(
                "flex justify-between items-center relative py-2 min-h-11 transition-opacity duration-700",
                isPast ? "opacity-40" : "opacity-100"
            )}>
                <div className={cn(
                    "absolute -left-4.25 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full z-0 shadow-md transition-colors duration-700",
                    isPast ? "bg-foreground/20" : "bg-foreground/50"
                )} />

                {isCurrent && (
                    <div className="absolute -left-4.25 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full z-10 shadow-md bg-primary ring-4 ring-primary/20">
                        <div className="absolute inset-0 rounded-full bg-primary/60 animate-ping" style={{ animationDuration: '2s' }} />
                    </div>
                )}

                {isNext && (
                    <div className="absolute -left-5 -top-2 text-primary animate-slide-down-fade z-20">
                        <ChevronDown size={16} strokeWidth={3} />
                    </div>
                )}

                <div className="flex flex-col items-start min-w-0 pr-2 flex-1">
                    <div className="flex items-center gap-1.5 w-full">
                        {showZone && (
                            <span className="text-[9px] text-muted-foreground/80 font-semibold bg-foreground/5 px-1 py-0.5 rounded-[3px] border border-border/40 leading-none tabular-nums flex-shrink-0 transition-colors duration-700">
                                {stop.properties.zone_id}
                            </span>
                        )}
                        {rawStopId ? (
                            <button
                                type="button"
                                onClick={() => navigate(paths.stop(selectedCity, rawStopId))}
                                aria-label={t('map.vehicleDetails.viewStopDepartures', { stopName: stop.properties.stop_name })}
                                className={cn(
                                    "text-sm truncate min-w-0 text-left cursor-pointer transition-colors duration-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-xs hover:underline hover:text-primary active:opacity-80",
                                    nameClass
                                )}
                            >
                                {stop.properties.stop_name}
                            </button>
                        ) : (
                            <span className={cn("text-sm truncate min-w-0 transition-colors duration-700", nameClass)}>
                                {stop.properties.stop_name}
                            </span>
                        )}
                        {stop.properties.is_request_stop && (
                            <Popover>
                                <PopoverTrigger className="flex items-center text-muted-foreground shrink-0 cursor-pointer outline-none hover:text-foreground transition-colors">
                                    <Hand size={14} strokeWidth={1.5} />
                                </PopoverTrigger>
                                <PopoverContent side="top" className="w-auto px-3 py-1.5 min-w-30 text-center">
                                    <span className="text-sm font-medium">{t('map.vehicleDetails.requestStop')}</span>
                                </PopoverContent>
                            </Popover>
                        )}
                        <div className="flex gap-1 shrink-0 translate-y-px">
                            <InterchangeBadges codes={forStop(stop.properties.stop_name, routeName)} />
                        </div>
                    </div>
                </div>
                <TimelineTime {...time} isPast={isPast} />
            </div>
            {!isLastStop && stop.properties.connections && (
                <StopConnections connections={stop.properties.connections} isPast={isPast} defaultOpen={isFirstTransfer} />
            )}
            {!isLastStop && stop.properties.continues_as && (
                <StopContinuation continuation={stop.properties.continues_as} isPast={isPast} />
            )}
        </>
    );
});

StopTimelineItem.displayName = 'StopTimelineItem';
