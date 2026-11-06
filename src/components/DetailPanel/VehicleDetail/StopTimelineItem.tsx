import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Hand } from 'lucide-react';
import { cn } from '@/lib/cn';
import { stopDisplayTimes } from '@/domain/vehicles';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useInterchanges } from '@/hooks/derived/useInterchanges';
import { InterchangeBadges } from '@/components/InterchangeBadges';
import { TimelineTime } from './TimelineTime';
import { StopConnections, StopContinuation } from './StopTransfers';
import type { TimelineStop } from './types';
import type { JourneyMark } from '@/types';
import { Pressable } from '@/components/Pressable';

export const StopTimelineItem = memo(({ stop, routeName, isPast, effectiveSequence, nextStopSequence, delay, isFirstTransfer, isLastStop, exitKind, isOnJourney = false, onOpenStop }: {
    stop: TimelineStop,
    routeName: string,
    isPast: boolean,
    effectiveSequence: number | null,
    nextStopSequence: number | null,
    delay?: number | null,
    isFirstTransfer: boolean,
    /** The line's own last stop; its transfer card is rendered outside the line's gutter instead. */
    isLastStop: boolean,
    /** A stop of the user's trip: where they get off (`own`) or board (`board`), or the exit a shared ride link marks (`shared`). */
    exitKind: JourneyMark,
    /** Between the vehicle and the ride's exit. */
    isOnJourney?: boolean,
    /** Opens a stop's board from the timeline. */
    onOpenStop: (stop: TimelineStop) => void
}) => {
    const { t } = useTranslation();
    const { forStop } = useInterchanges();
    const stopSeq = Number(stop.properties.stop_sequence);
    const isCurrent = stopSeq === effectiveSequence;
    const isNext = stopSeq === nextStopSequence;
    const isExit = exitKind !== null;
    const showZone = !!stop.properties.zone_id;

    const rawStopId = stop.properties.stop_id ? String(stop.properties.stop_id) : '';

    if (rawStopId.startsWith('incomplete-gap')) {
        return (
            <div className="flex items-center relative py-2 opacity-50">
                <div className="absolute -left-4.75 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-foreground/30 z-10" />
                <div className="flex-1 pl-2">
                    <span className="type-note text-muted-foreground italic">...</span>
                </div>
            </div>
        );
    }

    const nameClass = isCurrent ? "text-foreground font-semibold" : isNext ? "text-foreground font-semibold" : isPast ? "text-label-3 font-normal" : "text-foreground font-medium";
    const time = stopDisplayTimes(stop, isPast, isCurrent, isLastStop, delay);

    return (
        <>
            <div
                className="group flex justify-between items-center relative py-1.5 min-h-10"
            >
                <div className={cn(
                    "absolute top-1/2 -translate-y-1/2 rounded-full z-0 transition-colors duration-300",
                    isLastStop ? "-left-5.5 size-3" : "-left-5 size-2",
                    exitKind === 'own' ? "bg-white ring-[3px] ring-(--line)"
                        : isExit ? "bg-background ring-[3px] ring-(--line)"
                        : isLastStop && !isPast ? "bg-white ring-3 ring-(--line) inset-ring inset-ring-black/40"
                        : isOnJourney ? "bg-white ring ring-black/40"
                        : isPast ? "bg-label-3" : "bg-white ring ring-black/40"
                )} />

                {isCurrent && (
                    <div className="absolute -left-5.75 top-1/2 size-3.5 -translate-y-1/2 rounded-full z-10 bg-white ring-3 ring-(--line) inset-ring inset-ring-black/40">
                        <div className="absolute inset-0 rounded-full bg-white/60 animate-ping" style={{ animationDuration: '2s' }} />
                    </div>
                )}

                {isNext && !isExit && (
                    <div className="absolute -left-6 -top-4 z-20 text-white drop-shadow-md animate-slide-down-fade">
                        <ChevronDown size={16} strokeWidth={3} />
                    </div>
                )}

                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-1.5 min-w-0 pr-2 flex-1">
                    {showZone ? (
                        <span className="grid h-4.5 min-w-4.5 place-items-center rounded-badge bg-fill-2 px-1 type-micro text-muted-foreground tabular-nums shrink-0 transition-colors duration-700">
                            {stop.properties.zone_id}
                        </span>
                    ) : <span />}
                    <div className="flex items-center gap-1.5 min-w-0">
                        {rawStopId ? (
                            <Pressable
                                onClick={() => onOpenStop(stop)}
                                aria-label={t('map.vehicleDetails.viewStopDepartures', { stopName: stop.properties.stop_name })}
                                className={cn(
                                    "type-row truncate min-w-0 text-left transition-colors duration-700 focus-visible:ring-1 focus-visible:ring-ring rounded-badge hover:underline active:opacity-80",
                                    nameClass
                                )}
                            >
                                {stop.properties.stop_name}
                            </Pressable>
                        ) : (
                            <span className={cn("type-row truncate min-w-0 transition-colors duration-700", nameClass)}>
                                {stop.properties.stop_name}
                            </span>
                        )}
                        {stop.properties.is_request_stop && (
                            <Popover>
                                <PopoverTrigger className="flex items-center text-muted-foreground shrink-0 cursor-pointer outline-none hover:text-foreground transition-colors">
                                    <Hand size={13} strokeWidth={1.5} />
                                </PopoverTrigger>
                                <PopoverContent side="top" className="w-auto px-3 py-1.5 min-w-30 text-center">
                                    <span className="type-row">{t('map.vehicleDetails.requestStop')}</span>
                                </PopoverContent>
                            </Popover>
                        )}
                        <div className="flex gap-1 shrink-0 translate-y-px">
                            <InterchangeBadges codes={forStop(stop.properties.stop_name, routeName)} />
                        </div>
                    </div>
                    {isExit ? (
                        <span className="col-start-2 type-label text-tint-mint mt-0.5">{exitKind === 'shared' ? t('share.sharedExit') : exitKind === 'board' ? t('myTrip.kickerBoard') : t('ride.yourStop')}</span>
                    ) : null}
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
