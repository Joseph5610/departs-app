import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing, ChevronDown, ChevronRight, ChevronUp, UserRound, X } from 'lucide-react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { useSearch } from 'wouter';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useRideStore } from '@/state/rideStore';
import { StopTimelineItem } from './StopTimelineItem';
import { countStopsLeft, exitArrival, followKey } from '@/domain/rides';
import { firstTransferSequence as firstTransfer, lastStopOf, nextStopSequence as nextSequence, pastStopsCount as countPastStops } from '@/domain/vehicles';
import { StopConnections, StopContinuation } from './StopTransfers';
import type { StopFeature, StopTimelineProps } from './types';
import { paths } from '@/lib/routes';
import { navigate } from '@/lib/history';
import { useSelectionStore } from '@/state/selectionStore';
import { useStops } from '@/hooks/data/useStops';
import { requestNotificationPermission } from '@/lib/notifications';
import { SHARED_GROUND } from '@/config/constants';
import { boardableStopId, indexStops } from '@/domain/stops';

/** The trip's stops on a vertical line, with past stops collapsed behind a toggle. */
export const StopTimeline = ({ stopTimes, routeName, effectiveSequence, delay, tripId, vehicleId, hasEnded }: StopTimelineProps) => {
    const { t } = useTranslation();
    const [showPastStops, setShowPastStops] = useState(false);
    const [isPickingExit, setIsPickingExit] = useState(false);
    const searchString = useSearch();
    const search = new URLSearchParams(searchString);
    const sharedExitParam = search.get('exit');
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const rideExitSequence = useRideStore(s => s.ride?.tripId === tripId ? s.ride.exitSequence : null);
    const followedExitSequence = useRideStore(s => s.followed?.tripId === tripId ? s.followed.exitSequence : null);
    const unfollowedKey = useRideStore(s => s.unfollowedKey);
    const linkExitSequence = sharedExitParam !== null && Number.isFinite(Number(sharedExitParam)) ? Number(sharedExitParam) : null;
    /** The stop a shared ride gets off at: from the link, else from the ride being followed on this trip. */
    const sharedExitSequence = linkExitSequence ?? followedExitSequence;
    const { startRide, endRide, follow, unfollow } = useRideStore(s => s.actions);

    const { stopIndex, stops, centroids } = useStops();
    const stationGrid = useMemo(() => indexStops(centroids, SHARED_GROUND.TWIN_STATION_RADIUS_M), [centroids]);
    const platformGrid = useMemo(() => indexStops(stops, SHARED_GROUND.TWIN_STATION_RADIUS_M), [stops]);
    const { presetTripHighlight } = useSelectionStore(s => s.actions);
    /** Opens a timeline stop's board; an arrival-only platform (a terminus) opens the nearby same-named stop that has departures. */
    const openStop = useCallback((stop: StopFeature) => {
        const targetId = boardableStopId(stop, stopIndex, stationGrid, platformGrid);
        presetTripHighlight(tripId);
        navigate(paths.stop(selectedCity, targetId));
    }, [presetTripHighlight, tripId, selectedCity, stopIndex, stationGrid, platformGrid]);

    const followSharedRide = useCallback((sequence: number, stopName: string) => {
        follow({ city: selectedCity, tripId, vehicleId, exitSequence: sequence, exitStopName: stopName });
    }, [selectedCity, tripId, vehicleId, follow]);

    const pickExit = useCallback((sequence: number, stopName: string) => {
        startRide({ city: selectedCity, tripId, vehicleId, exitSequence: sequence, exitStopName: stopName });
        setIsPickingExit(false);
        toast(t('ride.started', { stop: stopName }));
        void requestNotificationPermission();
    }, [selectedCity, tripId, vehicleId, startRide, t]);

    const nextStopSequence = useMemo(() => nextSequence(stopTimes, effectiveSequence), [stopTimes, effectiveSequence]);

    /** Only the first upcoming stop with transfers starts expanded, so long lists stay scannable. */
    const firstTransferSequence = useMemo(() => firstTransfer(stopTimes, effectiveSequence), [stopTimes, effectiveSequence]);

    const pastStopsCount = useMemo(() => countPastStops(stopTimes, effectiveSequence), [stopTimes, effectiveSequence]);

    /** The line must stop at the last dot, not run behind that stop's own transfer card. */
    const lastStop = useMemo(() => lastStopOf(stopTimes), [stopTimes]);
    const lastStopSequence = lastStop ? Number(lastStop.properties.stop_sequence) : null;
    const lastStopIsPast = lastStopSequence !== null && effectiveSequence !== null && lastStopSequence < effectiveSequence;
    const sharedExit = sharedExitSequence !== null ? exitArrival(stopTimes, sharedExitSequence, delay) : null;

    // A shared link follows its ride on open, unless the user stopped following it or it is their own ride.
    useEffect(() => {
        if (linkExitSequence === null || !sharedExit || hasEnded) return;
        const key = followKey({ tripId, exitSequence: linkExitSequence });
        if (unfollowedKey === key || followedExitSequence === linkExitSequence || rideExitSequence === linkExitSequence) return;
        followSharedRide(linkExitSequence, sharedExit.stopName);
    }, [linkExitSequence, sharedExit, hasEnded, tripId, unfollowedKey, followedExitSequence, rideExitSequence, followSharedRide]);
    /** The stretch still to ride, to the user's own exit or else a followed one. */
    const journeyEnd = rideExitSequence ?? sharedExitSequence;
    const rideExit = rideExitSequence !== null ? exitArrival(stopTimes, rideExitSequence, delay) : null;
    const rideExitStopName = rideExitSequence === null ? null : rideExit?.stopName ?? '';
    const rideStopsLeft = useMemo(
        () => (rideExitSequence === null || effectiveSequence === null ? null : countStopsLeft(stopTimes, effectiveSequence, rideExitSequence)),
        [stopTimes, effectiveSequence, rideExitSequence],
    );

    if (!stopTimes.length) return null;

    return (
        <Collapsible open={showPastStops} onOpenChange={setShowPastStops}>
            <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center gap-2 px-1">
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
                {sharedExit && (
                    <div className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2 min-h-9 transition-colors",
                        followedExitSequence === sharedExitSequence ? "border-primary/30 bg-primary/10" : "border-border/50 bg-foreground/5"
                    )}>
                        <UserRound size={16} strokeWidth={1.5} className="text-primary shrink-0" />
                        <span className="flex-1 min-w-0 text-sm font-medium leading-snug line-clamp-2">
                            {sharedExit.time
                                ? t('share.friendExit', { stop: sharedExit.stopName, time: sharedExit.time })
                                : t('share.friendExitNoTime', { stop: sharedExit.stopName })}
                        </span>
                        {followedExitSequence === sharedExitSequence ? (
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => unfollow(true)}
                                aria-label={t('share.stopWatching')}
                                title={t('share.stopWatching')}
                                className="size-7 rounded-full text-muted-foreground hover:text-foreground shrink-0"
                            >
                                <X size={14} strokeWidth={2} />
                            </Button>
                        ) : !hasEnded && sharedExitSequence !== null && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    followSharedRide(sharedExitSequence, sharedExit.stopName);
                                    toast(t('share.watchStarted', { stop: sharedExit.stopName }));
                                }}
                                className="h-7 rounded-lg micro-label text-primary hover:bg-primary/15 hover:text-primary shrink-0"
                            >
                                {t('share.watch')}
                            </Button>
                        )}
                    </div>
                )}
                {!hasEnded && (
                    <RideControl
                        isPicking={isPickingExit}
                        exitStopName={rideExitStopName}
                        stopsLeft={rideStopsLeft}
                        arrivalTime={rideExit?.time ?? null}
                        onPick={() => setIsPickingExit(true)}
                        onCancel={() => setIsPickingExit(false)}
                        onEnd={endRide}
                    />
                )}
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
                                        exitKind={null}
                                        onOpenStop={openStop}
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
                                    exitKind={Number(stop.properties.stop_sequence) === rideExitSequence ? 'own' : Number(stop.properties.stop_sequence) === sharedExitSequence ? 'shared' : null}
                                    isOnJourney={journeyEnd !== null && Number(stop.properties.stop_sequence) > (effectiveSequence ?? 0) && Number(stop.properties.stop_sequence) < journeyEnd}
                                    onOpenStop={openStop}
                                    isPicking={isPickingExit && !hasEnded}
                                    onPickExit={isPickingExit && !hasEnded && Number(stop.properties.stop_sequence) > (effectiveSequence ?? 0) ? pickExit : undefined}
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

/** Starts picking the rider's stop, explains the pick, or shows the stop being ridden to. */
const RideControl = ({ isPicking, exitStopName, stopsLeft, arrivalTime, onPick, onCancel, onEnd }: {
    isPicking: boolean;
    /** Null while no ride is active on this trip. */
    exitStopName: string | null;
    stopsLeft: number | null;
    arrivalTime: string | null;
    onPick: () => void;
    onCancel: () => void;
    onEnd: () => void;
}) => {
    const { t } = useTranslation();

    const isActive = exitStopName !== null;

    if (!isActive && !isPicking) {
        return (
            <button
                type="button"
                onClick={onPick}
                className="group w-full flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-3 py-2.5 text-left cursor-pointer transition-colors hover:bg-muted/50 outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
                <span className="grid place-items-center size-9 shrink-0 rounded-full bg-primary/10 text-primary">
                    <BellRing size={18} strokeWidth={1.75} />
                </span>
                <span className="flex flex-col flex-1 min-w-0 leading-snug">
                    <span className="text-sm font-semibold text-foreground">{t('ride.pick')}</span>
                    <span className="text-xs text-muted-foreground">{t('ride.pickSub')}</span>
                </span>
                <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </button>
        );
    }

    return (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 pl-3 pr-1.5 py-2.5">
            <span className={cn(
                "grid place-items-center size-9 shrink-0 rounded-full",
                isActive ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"
            )}>
                <BellRing size={18} strokeWidth={1.75} />
            </span>
            <span className="flex flex-col flex-1 min-w-0 leading-snug">
                {isActive ? (
                    <>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{t('ride.kickerRiding')}</span>
                        <span className="text-sm font-semibold text-foreground line-clamp-2">{exitStopName}</span>
                        {(stopsLeft !== null || arrivalTime) && (
                            <span className="text-xs text-muted-foreground tabular-nums">
                                {stopsLeft !== null && t('ride.stopsLeft', { count: stopsLeft })}
                                {stopsLeft !== null && arrivalTime && ' · '}
                                {arrivalTime && `${t('ride.arrivesAtLabel')} ${arrivalTime}`}
                            </span>
                        )}
                    </>
                ) : (
                    <span className="text-sm font-semibold text-primary line-clamp-2">{t('ride.pickHint')}</span>
                )}
            </span>
            <Button
                variant="ghost"
                size="sm"
                onClick={isActive ? onEnd : onCancel}
                className="h-8 rounded-lg micro-label text-primary hover:bg-primary/15 hover:text-primary shrink-0"
            >
                {isActive ? t('ride.end') : t('ride.cancel')}
            </Button>
        </div>
    );
};
