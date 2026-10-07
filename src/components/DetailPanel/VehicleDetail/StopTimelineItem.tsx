import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Hand } from 'lucide-react';
import { cn } from 'cn';
import { stopDisplayTimes } from '@/domain/vehicles';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useInterchanges } from '@/hooks/derived/useInterchanges';
import { InterchangeBadges } from '@/components/InterchangeBadges';
import { TimelineTime } from './TimelineTime';
import { StopConnections, StopContinuation } from './StopTransfers';
import type { StopFeature } from './types';

export const StopTimelineItem = memo(({ stop, routeName, isPast, effectiveSequence, nextStopSequence, delay, isFirstTransfer, isLastStop, exitKind, isOnJourney = false, onOpenStop, isPicking = false, onPickExit }: {
    stop: StopFeature,
    routeName: string,
    isPast: boolean,
    effectiveSequence: number | null,
    nextStopSequence: number | null,
    delay?: number | null,
    isFirstTransfer: boolean,
    /** The line's own last stop; its transfer card is rendered outside the line's gutter instead. */
    isLastStop: boolean,
    /** The stop the active ride gets off at (`own`), or the one a shared ride link marks (`shared`). */
    exitKind: 'own' | 'shared' | null,
    /** Between the vehicle and the ride's exit. */
    isOnJourney?: boolean,
    /** Opens a stop's board from the timeline. */
    onOpenStop: (stop: StopFeature) => void,
    /** The rider is picking their stop: the row picks instead of opening the stop, and rows that can't be picked dim. */
    isPicking?: boolean,
    /** Set on the rows that can be picked. */
    onPickExit?: (sequence: number, stopName: string) => void
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
                <div className="absolute -left-3.75 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-foreground/30 z-10" />
                <div className="flex-1 pl-2">
                    <span className="text-xs text-muted-foreground italic">...</span>
                </div>
            </div>
        );
    }

    const nameClass = isCurrent ? "text-primary font-bold" : isNext ? "text-foreground font-bold" : isPast ? "text-muted-foreground" : "text-foreground font-medium";
    const time = stopDisplayTimes(stop, isPast, isCurrent, isLastStop, delay);

    const isPickable = !!onPickExit;
    const pickThis = () => onPickExit?.(stopSeq, stop.properties.stop_name);

    return (
        <>
            <div
                className={cn(
                    "group flex justify-between items-center relative py-2 min-h-11 transition-opacity duration-300",
                    isPast || (isPicking && !isPickable) ? "opacity-40" : "opacity-100",
                    isPickable && "cursor-pointer outline-none"
                )}
                {...(isPickable ? {
                    role: 'button',
                    tabIndex: 0,
                    'aria-label': t('ride.pickStop', { stop: stop.properties.stop_name }),
                    onClick: pickThis,
                    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickThis(); } },
                } : {})}
            >
                {isPickable && (
                    <span className="absolute inset-y-0.5 -left-8 -right-2 rounded-xl transition-colors group-hover:bg-primary/10 group-active:bg-primary/15 group-focus-visible:ring-2 group-focus-visible:ring-primary/50" aria-hidden="true" />
                )}
                <div className={cn(
                    "absolute -left-4.25 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full z-0 shadow-md transition-colors duration-300",
                    isExit ? "bg-background ring-[3px] ring-primary"
                        : isPickable ? "bg-background ring-2 ring-primary/70"
                        : isOnJourney ? "bg-primary/70"
                        : isPast ? "bg-foreground/20" : "bg-foreground/50"
                )} />

                {isCurrent && (
                    <div className="absolute -left-4.25 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full z-10 shadow-md bg-primary ring-4 ring-primary/20">
                        <div className="absolute inset-0 rounded-full bg-primary/60 animate-ping" style={{ animationDuration: '2s' }} />
                    </div>
                )}

                {isNext && !isExit && (
                    <div className="absolute -left-5 -top-2 text-primary animate-slide-down-fade z-20">
                        <ChevronDown size={16} strokeWidth={3} />
                    </div>
                )}

                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-1.5 min-w-0 pr-2 flex-1">
                    {showZone ? (
                        <span className="text-[9px] text-muted-foreground/80 font-semibold bg-foreground/5 px-1 py-0.5 rounded-[3px] border border-border/40 leading-none tabular-nums flex-shrink-0 transition-colors duration-700">
                            {stop.properties.zone_id}
                        </span>
                    ) : <span />}
                    <div className="flex items-center gap-1.5 min-w-0">
                        {!isPicking && rawStopId ? (
                            <button
                                type="button"
                                onClick={() => onOpenStop(stop)}
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
                    {isExit ? (
                        <span className="col-start-2 text-[9px] font-bold uppercase tracking-wider text-primary leading-none mt-0.5">{exitKind === 'shared' ? t('share.sharedExit') : t('ride.yourStop')}</span>
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
