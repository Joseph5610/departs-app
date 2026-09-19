import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Accessibility, ArrowRight, ArrowRightLeft, ChevronDown, ChevronUp, CornerDownRight, Hand, type LucideIcon } from 'lucide-react';
import { navigate } from 'wouter/use-browser-location';
import { paths } from '../../../lib/routes';
import { cn, getContrastColor } from '@/lib/utils';
import { safeHexColor } from '@/lib/color';
import { FALLBACK_ROUTE_COLOR } from '@/config/constants';
import { calculateTimeDifferenceSecs, addSecondsToTime, formatDelay } from '../../../utils/dateUtils';
import { getDelayStatus } from '../../../config/transit';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { LineBadge } from '../../LineBadge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePreferencesStore } from '../../../state/preferencesStore';
import { useMetroLines } from '../../../hooks/derived/useMetroLines';

import type { StopFeature, StopTimelineProps } from './types';
import type { Continuation, MetroExits, StopConnection } from '../../../types/vehicles';

/**
 * StopTimeline
 *
 * Renders the collapsible stop list with past/future split.
 * Extracted from VehicleDetail to reduce monolith size.
 * The timeline visually shows a vertical line with dots for each stop.
 */
export const StopTimeline: React.FC<StopTimelineProps> = ({ stopTimes, effectiveSequence, delay, routeColor }) => {
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

    /** The next station's exits, shown once above the list rather than at every station. */
    const nextStationExits = useMemo(() => {
        const next = stopTimes.find((s) => Number(s.properties.stop_sequence) === nextStopSequence)
            ?? (effectiveSequence === null ? stopTimes[1] : undefined);
        return next?.properties.metro_exits ? { station: next.properties.stop_name, exits: next.properties.metro_exits } : null;
    }, [stopTimes, nextStopSequence, effectiveSequence]);

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
                {nextStationExits && (
                    <MetroExitCard station={nextStationExits.station} exits={nextStationExits.exits} routeColor={routeColor} />
                )}
                <div className="relative pl-6 overflow-hidden!">
                    <div className={cn(
                        "absolute left-2.75 bottom-6 w-0.5 bg-border",
                        (pastStopsCount === 0 || showPastStops) ? "top-6" : "top-0"
                    )} />

                    {/* Past Stops (Collapsible) */}
                    <CollapsibleContent className="animate-in fade-in-0 slide-in-from-top-1 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-1 data-[state=closed]:overflow-hidden data-[state=open]:overflow-visible">
                        {stopTimes
                            .filter(stop => Number(stop.properties.stop_sequence) < (effectiveSequence ?? 0))
                            .map((stop, idx: number) => (
                                <StopItem
                                    key={`past-${stop.properties.stop_sequence || idx}`}
                                    stop={stop}
                                    isPast={true}
                                    effectiveSequence={effectiveSequence}
                                    nextStopSequence={nextStopSequence}
                                    delay={delay}
                                    isFirstTransfer={false}
                                />
                            ))
                        }
                    </CollapsibleContent>

                    {/* Current & Future Stops */}
                    {stopTimes
                        .filter(stop => Number(stop.properties.stop_sequence) >= (effectiveSequence ?? 0))
                        .map((stop, idx: number) => (
                            <StopItem
                                key={`future-${stop.properties.stop_sequence || idx}`}
                                stop={stop}
                                isPast={false}
                                effectiveSequence={effectiveSequence}
                                nextStopSequence={nextStopSequence}
                                delay={delay}
                                isFirstTransfer={Number(stop.properties.stop_sequence) === firstTransferSequence}
                            />
                        ))
                    }
                </div>
            </div>
        </Collapsible>
    );
};

StopTimeline.displayName = 'StopTimeline';

const StopItem = React.memo(({ stop, isPast, effectiveSequence, nextStopSequence, delay, isFirstTransfer }: {
    stop: StopFeature,
    isPast: boolean,
    effectiveSequence: number | null,
    nextStopSequence: number | null,
    delay?: number | null,
    isFirstTransfer: boolean
}) => {
    const { t } = useTranslation();
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { forStop } = useMetroLines();
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
            navigate(paths.stop(selectedCity, rawStopId));
        }
    };

    return (
        <>
            <div className={cn(
                "flex justify-between items-center relative py-2 min-h-11 transition-opacity duration-700",
                isPast ? "opacity-40" : "opacity-100"
            )}>
                {/* The base grey dot */}
                <div className={cn(
                    "absolute -left-4.25 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full z-0 shadow-md transition-colors duration-700",
                    isPast ? "bg-foreground/20" : "bg-foreground/50"
                )} />

                {/* The animated green dot */}
                {isCurrent && (
                    <div className="absolute -left-4.25 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full z-10 shadow-md bg-primary ring-4 ring-primary/20">
                        <div className="absolute inset-0 rounded-full bg-primary/60 animate-ping" style={{ animationDuration: '2s' }} />
                    </div>
                )}
            
                {/* The animated next chevron */}
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
                        {hasValidStopId ? (
                            <button
                                type="button"
                                onClick={handleStopClick}
                                aria-label={t('map.vehicleDetails.viewStopDepartures', { stopName: stop.properties.stop_name })}
                                className={cn(
                                    "text-sm truncate min-w-0 text-left cursor-pointer transition-colors duration-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-xs hover:underline hover:text-primary active:opacity-80",
                                    isCurrent ? "text-primary font-bold" : isNext ? "text-foreground font-bold" : isPast ? "text-muted-foreground" : "text-foreground font-medium"
                                )}
                            >
                                {stop.properties.stop_name}
                            </button>
                        ) : (
                            <span className={cn(
                                "text-sm truncate min-w-0 transition-colors duration-700",
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
                                    <span className="text-sm font-medium">{t('map.vehicleDetails.requestStop')}</span>
                                </PopoverContent>
                            </Popover>
                        )}
                        <div className="flex gap-1 shrink-0 translate-y-px">
                            {forStop(rawStopId, stop.properties.stop_name).map((line) => (
                                <LineBadge key={line.name} name={line.name} routeColor={line.route_color} />
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end shrink-0 min-w-17">
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
                            isLate = getDelayStatus(diff) === 'late';
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
            {stop.properties.connections && (
                <StopConnections connections={stop.properties.connections} isPast={isPast} defaultOpen={isFirstTransfer} />
            )}
            {stop.properties.continues_as && (
                <StopContinuation continuation={stop.properties.continues_as} isPast={isPast} />
            )}
        </>
    );
});

StopItem.displayName = 'StopItem';

/** A collapsible, labelled block under a stop listing trips a passenger can change to there. */
const StopTransferBlock = ({ icon: Icon, title, isPast, defaultOpen, preview, children }: {
    icon: LucideIcon,
    title: string,
    isPast: boolean,
    defaultOpen: boolean,
    /** Shown in the header while collapsed. */
    preview?: React.ReactNode,
    children: React.ReactNode
}) => {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <Collapsible
            open={open}
            onOpenChange={setOpen}
            className={cn(
                "mb-1 rounded-lg border border-border/50 bg-muted/40 px-2 py-1 transition-opacity duration-700",
                isPast ? "opacity-40" : "opacity-100"
            )}
        >
            <CollapsibleTrigger className="w-full flex items-center gap-1.5 px-1 py-0.5 micro-label text-muted-foreground cursor-pointer rounded-md outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring">
                <Icon size={12} strokeWidth={2} className="shrink-0" />
                <span className="shrink-0">{title}</span>
                <span className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
                    {!open && preview}
                </span>
                {open ? <ChevronUp size={14} strokeWidth={1.5} className="shrink-0" /> : <ChevronDown size={14} strokeWidth={1.5} className="shrink-0" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
                <ul aria-label={title} className="flex flex-col">
                    {children}
                </ul>
            </CollapsibleContent>
        </Collapsible>
    );
};

/** One onward trip; opens it when its trip id is known. */
const ConnectionRow = ({ tripId, vehicleId, line, routeColor, headsign, time, delay, note, isWarning }: {
    tripId?: string,
    vehicleId?: string,
    line: string,
    routeColor?: string,
    headsign: string,
    time?: string,
    delay?: number | null,
    note?: string,
    isWarning?: boolean
}) => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);

    const content = (
        <>
            <LineBadge name={line} routeColor={routeColor ?? ''} size="lg" />
            <span className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium truncate">{headsign}</span>
                {note && (
                    <span className={cn(
                        "text-[10px] leading-tight",
                        isWarning ? "text-destructive font-semibold" : "text-muted-foreground"
                    )}>
                        {note}
                    </span>
                )}
            </span>
            {typeof delay === 'number' && delay !== 0 && (
                <span className={cn(
                    "text-xs font-bold tabular-nums shrink-0",
                    delay > 0 ? "text-destructive" : "text-sky-500"
                )}>
                    {formatDelay(delay)}
                </span>
            )}
            {time && (
                <span className="text-xs tabular-nums text-muted-foreground shrink-0 text-right">
                    {time.slice(0, 8)}
                </span>
            )}
        </>
    );
    const rowClass = "w-full flex items-center gap-2 px-1 py-1.5 text-left rounded-md";

    return (
        <li>
            {tripId ? (
                <button
                    type="button"
                    onClick={() => navigate(paths.trip(selectedCity, tripId, vehicleId))}
                    className={cn(rowClass, "cursor-pointer hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring")}
                >
                    {content}
                </button>
            ) : (
                <div className={rowClass}>{content}</div>
            )}
        </li>
    );
};

/** Onward trips that wait at this stop for the viewed trip. */
const StopConnections = React.memo(({ connections, isPast, defaultOpen }: {
    connections: StopConnection[],
    isPast: boolean,
    defaultOpen: boolean
}) => {
    const { t } = useTranslation();

    const previewLines = useMemo(() => {
        const byName = new Map<string, string>();
        for (const c of connections) if (!byName.has(c.line)) byName.set(c.line, c.route_color ?? '');
        return [...byName];
    }, [connections]);

    const preview = previewLines.map(([line, color]) => (
        <LineBadge key={line} name={line} routeColor={color} size="sm" />
    ));

    return (
        <StopTransferBlock
            icon={ArrowRightLeft}
            title={t('map.vehicleDetails.connections.title')}
            isPast={isPast}
            defaultOpen={defaultOpen}
            preview={preview}
        >
            {connections.map((c) => {
                const showRisk = c.at_risk && !isPast;
                return (
                    <ConnectionRow
                        key={c.trip_id}
                        tripId={c.trip_id}
                        vehicleId={c.vehicle_id}
                        line={c.line}
                        routeColor={c.route_color}
                        headsign={c.headsign}
                        time={c.departure_time}
                        delay={c.delay}
                        note={showRisk
                            ? t('map.vehicleDetails.connections.mayNotWait')
                            : t('map.vehicleDetails.connections.waitsUpTo', { minutes: Math.round(c.max_wait_s / 60) })}
                        isWarning={showRisk}
                    />
                );
            })}
        </StopTransferBlock>
    );
});

StopConnections.displayName = 'StopConnections';

/** The trip the vehicle continues as after its last stop. */
const StopContinuation = React.memo(({ continuation, isPast }: {
    continuation: Continuation,
    isPast: boolean
}) => {
    const { t } = useTranslation();

    return (
        <StopTransferBlock icon={CornerDownRight} title={t('map.vehicleDetails.continuesAs')} isPast={isPast} defaultOpen>
            <ConnectionRow
                tripId={continuation.trip_id}
                vehicleId={continuation.vehicle_id}
                line={continuation.line}
                routeColor={continuation.route_color}
                headsign={continuation.headsign}
                time={continuation.departure_time}
            />
        </StopTransferBlock>
    );
});

StopContinuation.displayName = 'StopContinuation';

const METRO_CAR_COUNT = 5;

/** Grid columns covered by these cars; the front car (1) is drawn rightmost, in the direction of travel. */
function carSpan(cars: number[]): [number, number] {
    const columns = cars.map((car) => METRO_CAR_COUNT + 1 - car);
    return [Math.min(...columns), Math.max(...columns) + 1];
}

interface ExitTag { key: string; name: string; span: [number, number]; stepFree: boolean }

/** Stacks tags into as few rows as possible without two tags sharing a car. */
function packTags(tags: ExitTag[]): Array<ExitTag & { row: number }> {
    /** Cars already tagged in each row, as a bitmask over the five columns. */
    const rowMasks: number[] = [];
    const packed: Array<ExitTag & { row: number }> = [];
    for (const tag of tags) {
        let mask = 0;
        for (let col = tag.span[0]; col < tag.span[1]; col++) mask |= 1 << col;
        let row = 0;
        while (row < rowMasks.length && (rowMasks[row]! & mask) !== 0) row++;
        rowMasks[row] = (rowMasks[row] ?? 0) | mask;
        packed.push({ ...tag, row: row + 1 });
    }
    return packed;
}

/** The next station as a platform diagram: exit tags above the cars nearest to them. */
const MetroExitCard = React.memo(({ station, exits, routeColor }: { station: string, exits: MetroExits, routeColor?: string }) => {
    const { t } = useTranslation();
    const color = safeHexColor(routeColor) ?? FALLBACK_ROUTE_COLOR;
    const textColor = getContrastColor(color);

    const { tags, rowCount } = useMemo(() => {
        const all: ExitTag[] = exits.exits.map((exit) => ({ key: exit.name, name: exit.name, span: carSpan(exit.cars), stepFree: false }));
        if (exits.step_free) all.push({ key: `step-free-${exits.step_free.name}`, name: exits.step_free.name, span: carSpan(exits.step_free.cars), stepFree: true });
        const packed = packTags(all);
        return { tags: packed, rowCount: Math.max(0, ...packed.map((tag) => tag.row)) };
    }, [exits]);

    return (
        <div className="rounded-xl border border-border/50 bg-muted/40 px-3 pt-2.5 pb-3">
            <div className="flex items-center justify-between gap-2 pb-2.5">
                <span className="micro-label text-muted-foreground truncate">
                    {t('map.vehicleDetails.metroExits.nextStation', { station })}
                </span>
                <span className="flex items-center gap-1 micro-label text-muted-foreground shrink-0">
                    {t('map.vehicleDetails.metroExits.direction')}
                    <ArrowRight size={12} strokeWidth={2} />
                </span>
            </div>

            <div className="grid grid-cols-5 gap-x-1 gap-y-1">
                {tags.map((tag) => (
                    <div key={tag.key} style={{ gridColumn: `${tag.span[0]} / ${tag.span[1]}`, gridRow: tag.row }} className="flex flex-col items-center">
                        {tag.stepFree ? (
                            <span className="inline-flex items-center gap-0.5 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                <Accessibility size={11} strokeWidth={2.5} aria-label={t('map.vehicleDetails.metroExits.stepFree')} />
                                {tag.name}
                            </span>
                        ) : (
                            <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: color, color: textColor }}>
                                {tag.name}
                            </span>
                        )}
                        <span
                            className={cn("mt-0.5 h-1.5 w-full rounded-t-sm border-x-2 border-t-2", tag.stepFree && "border-primary/70")}
                            style={tag.stepFree ? undefined : { borderColor: color }}
                        />
                    </div>
                ))}
                {Array.from({ length: METRO_CAR_COUNT }, (_, i) => {
                    const car = METRO_CAR_COUNT - i;
                    return (
                        <div
                            key={car}
                            style={{ gridRow: rowCount + 1 }}
                            className={cn("h-4 rounded-[3px] border border-foreground/20 bg-foreground/10", car === 1 && "rounded-r-full")}
                        />
                    );
                })}
            </div>

            <ul className="flex flex-col gap-1 pt-2.5 text-xs">
                {exits.exits.filter((exit) => exit.hint).map((exit) => (
                    <li key={exit.name} className="flex items-baseline gap-2 min-w-0">
                        <span className="font-bold text-foreground shrink-0">{exit.name}</span>
                        <span className="text-muted-foreground truncate">{exit.hint}</span>
                    </li>
                ))}
                {exits.step_free && (
                    <li className="flex items-baseline gap-2 min-w-0 text-primary">
                        <span className="inline-flex items-center gap-1 font-bold shrink-0">
                            <Accessibility size={12} strokeWidth={2} aria-hidden="true" />
                            {exits.step_free.name}
                        </span>
                        <span className="truncate">{t('map.vehicleDetails.metroExits.stepFree')}</span>
                    </li>
                )}
            </ul>
        </div>
    );
});

MetroExitCard.displayName = 'MetroExitCard';
