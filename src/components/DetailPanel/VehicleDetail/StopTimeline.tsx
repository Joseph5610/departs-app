import { useState, useMemo, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, UserRound, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { useSearch } from 'wouter';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useRideStore } from '@/state/rideStore';
import { MyTripCard } from './MyTripCard';
import type { JourneyLeg } from '@/components/JourneyRow';
import { StopTimelineItem } from './StopTimelineItem';
import { boardingAt, countStopsLeft, exitArrival, followKey, isOnJourney, journeyMark, journeySpan, linkSequence, stopDepartureClock } from '@/domain/rides';
import { useCityConfig } from '@/hooks/data/useCities';
import { useNowEvery } from '@/hooks/useNow';
import { firstTransferSequence as firstTransfer, lastStopOf, nextStopSequence as nextSequence, pastStopsCount as countPastStops } from '@/domain/vehicles';
import { StopConnections, StopContinuation } from './StopTransfers';
import type { TimelineStop, StopTimelineProps } from './types';
import { paths } from '@/lib/routes';
import { navigate } from '@/lib/history';
import { useSelectionStore } from '@/state/selectionStore';
import { useStops } from '@/hooks/data/useStops';
import { useUiStore } from '@/state/uiStore';
import { MY_TRIP_CONFIG, SHARED_GROUND } from '@/config/constants';
import { boardableStopId, indexStops } from '@/domain/stops';

/** The trip's stops on a vertical line, with past stops collapsed behind a toggle. */
export const StopTimeline = ({ stopTimes, routeName, effectiveSequence, delay, tripId, vehicleId, hasEnded }: StopTimelineProps) => {
    const { t } = useTranslation();
    const [showPastStops, setShowPastStops] = useState(false);
    const searchString = useSearch();
    const search = new URLSearchParams(searchString);
    const sharedExitParam = search.get('exit');
    const sharedBoardParam = search.get('board');
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const myTrip = useRideStore(s => s.trips.find(trip => trip.tripId === tripId) ?? null);
    /** The exit the user picked on this trip; a trip ridden to its end has none (its last stop is still marked as theirs). */
    const rideExitSequence = myTrip && !myTrip.toEnd ? myTrip.exitSequence : null;
    const followedTrip = useRideStore(s => (s.followed?.tripId === tripId ? s.followed : null));
    const unfollowedKey = useRideStore(s => s.unfollowedKey);
    const linkExitSequence = linkSequence(sharedExitParam);
    const linkBoardSequence = linkSequence(sharedBoardParam);
    /** Where a shared trip gets on and off: from the link, else from the trip being followed on this trip. */
    const sharedExitSequence = linkExitSequence ?? (followedTrip && !followedTrip.toEnd ? followedTrip.exitSequence : null);
    const sharedBoardSequence = linkBoardSequence ?? followedTrip?.board?.sequence ?? null;
    const { timezone } = useCityConfig(selectedCity);
    const now = useNowEvery(MY_TRIP_CONFIG.CLOCK_MS);
    const { endTrip, follow, unfollow } = useRideStore(s => s.actions);

    const { model } = useStops();
    const stationGrid = useMemo(() => indexStops(model?.stations.filter(s => !s.alightOnly) ?? [], SHARED_GROUND.TWIN_STATION_RADIUS_M), [model]);
    const platformGrid = useMemo(() => indexStops(model?.platforms.filter(p => !p.alightOnly) ?? [], SHARED_GROUND.TWIN_STATION_RADIUS_M), [model]);
    const { presetTripHighlight } = useSelectionStore(s => s.actions);
    /** Opens a timeline stop's board; an arrival-only platform (a terminus) opens its station, see `boardableStopId`. */
    const openStop = useCallback((stop: TimelineStop) => {
        const targetId = boardableStopId(stop, model, stationGrid, platformGrid);
        presetTripHighlight(tripId);
        navigate(paths.stop(selectedCity, targetId));
    }, [presetTripHighlight, tripId, selectedCity, model, stationGrid, platformGrid]);


    const boardingStopId = useSelectionStore(s => (s.boardingStop?.tripId === tripId ? s.boardingStop.stopId : null));
    const { openMyTrip } = useUiStore(s => s.actions);
    const openMyTripSheet = useCallback((section?: JourneyLeg) => {
        openMyTrip({ city: selectedCity, tripId, vehicleId, stopId: myTrip ? myTrip.board?.stopId ?? null : boardingStopId, section });
    }, [myTrip, boardingStopId, openMyTrip, selectedCity, tripId, vehicleId]);
    const endMyTrip = useCallback(() => endTrip(tripId), [endTrip, tripId]);

    /** An ended trip has no current or next stop: its whole run shows as past, nothing collapsed. */
    const currentSequence = hasEnded ? null : effectiveSequence;

    const nextStopSequence = useMemo(() => nextSequence(stopTimes, currentSequence), [stopTimes, currentSequence]);

    /** Only the first upcoming stop with transfers starts expanded, so long lists stay scannable. */
    const firstTransferSequence = useMemo(() => (hasEnded ? null : firstTransfer(stopTimes, currentSequence)), [stopTimes, currentSequence, hasEnded]);

    const pastStopsCount = useMemo(() => countPastStops(stopTimes, currentSequence), [stopTimes, currentSequence]);

    /** The line must stop at the last dot, not run behind that stop's own transfer card. */
    const lastStop = useMemo(() => lastStopOf(stopTimes), [stopTimes]);
    const lastStopSequence = lastStop ? Number(lastStop.properties.stop_sequence) : null;
    const lastStopIsPast = hasEnded || lastStopSequence !== null && effectiveSequence !== null && lastStopSequence < effectiveSequence;
    const sharedExit = useMemo(() => (sharedExitSequence !== null ? exitArrival(stopTimes, sharedExitSequence, delay) : null), [stopTimes, sharedExitSequence, delay]);
    const sharedBoard = useMemo(() => (sharedBoardSequence !== null ? boardingAt(stopTimes, sharedBoardSequence, now, timezone) : null), [stopTimes, sharedBoardSequence, now, timezone]);
    const sharedDepart = sharedBoardSequence !== null ? stopDepartureClock(stopTimes, sharedBoardSequence, delay) : null;
    /** The shared trip as followed: to its exit, else to the trip's end. */
    const sharedKeySequence = sharedExitSequence ?? lastStopSequence;
    const isFollowingShared = !!followedTrip && sharedKeySequence !== null && followedTrip.exitSequence === sharedKeySequence;

    const followSharedTrip = useCallback(() => {
        if (sharedKeySequence === null) return;
        follow({
            city: selectedCity, tripId, vehicleId,
            exitSequence: sharedKeySequence,
            exitStopName: sharedExit?.stopName ?? lastStop?.properties.stop_name ?? '',
            toEnd: sharedExitSequence === null,
            board: sharedBoard,
        });
    }, [follow, selectedCity, tripId, vehicleId, sharedKeySequence, sharedExit, lastStop, sharedExitSequence, sharedBoard]);

    // A shared link follows its trip on open, unless the user stopped following it or takes this trip themselves.
    // A link naming a stop this trip doesn't have is ignored rather than followed with made-up stops.
    const isLinkValid = (linkExitSequence === null || !!sharedExit) && (linkBoardSequence === null || !!sharedBoard);
    const hasLink = (linkExitSequence !== null || linkBoardSequence !== null) && isLinkValid;
    useEffect(() => {
        if (!hasLink || sharedKeySequence === null || hasEnded || myTrip) return;
        if (unfollowedKey === followKey({ tripId, exitSequence: sharedKeySequence }) || isFollowingShared) return;
        followSharedTrip();
    }, [hasLink, sharedKeySequence, hasEnded, myTrip, unfollowedKey, tripId, isFollowingShared, followSharedTrip]);
    const journey = journeySpan(myTrip, effectiveSequence, sharedExitSequence);
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
                {!hasEnded && (
                    <MyTripCard
                        trip={myTrip}
                        exit={rideExitStopName === null ? null : { stopName: rideExitStopName, stopsLeft: rideStopsLeft, arrivalTime: rideExit?.time ?? null }}
                        lastStopName={lastStop?.properties.stop_name ?? ''}
                        onOpen={openMyTripSheet}
                        onEnd={endMyTrip}
                    />
                )}
                <div className="flex justify-between items-center gap-2 px-1">
                    <span className="micro-label-widest text-muted-foreground">{t('map.vehicleDetails.routeSchedule')}</span>
                    {currentSequence !== null && pastStopsCount > 0 && (
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
                {(sharedExit || sharedBoard) && isLinkValid && !myTrip && (
                    <div className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2 min-h-9 transition-colors",
                        isFollowingShared ? "border-primary/30 bg-primary/10" : "border-border/50 bg-foreground/5"
                    )}>
                        <UserRound size={16} strokeWidth={1.5} className="text-primary shrink-0" />
                        <span className="flex-1 min-w-0 text-sm font-medium leading-snug line-clamp-2">
                            {sharedBoard
                                ? t(sharedExit ? 'share.friendTrip' : 'share.friendFrom', { from: sharedBoard.stopName, depart: sharedDepart ?? '', stop: sharedExit?.stopName })
                                : sharedExit?.time
                                ? t('share.friendExit', { stop: sharedExit.stopName, time: sharedExit.time })
                                : t('share.friendExitNoTime', { stop: sharedExit?.stopName ?? '' })}
                        </span>
                        {isFollowingShared ? (
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
                        ) : !hasEnded && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    followSharedTrip();
                                    toast(t('share.watchStarted', { stop: sharedExit?.stopName ?? lastStop?.properties.stop_name ?? '' }));
                                }}
                                className="h-7 rounded-lg micro-label text-primary hover:bg-primary/15 hover:text-primary shrink-0"
                            >
                                {t('share.watch')}
                            </Button>
                        )}
                    </div>
                )}
                <div>
                    <div className="relative pl-6 overflow-hidden!">
                        <div className={cn(
                            "absolute left-2.75 bottom-6 w-0.5 bg-border",
                            (pastStopsCount === 0 || showPastStops) ? "top-6" : "top-0"
                        )} />

                        <CollapsibleContent className="animate-in fade-in-0 slide-in-from-top-1 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-1 data-[state=closed]:overflow-hidden data-[state=open]:overflow-visible">
                            {stopTimes
                                .filter(stop => Number(stop.properties.stop_sequence) < (currentSequence ?? 0))
                                .map((stop, idx: number) => (
                                    <StopTimelineItem
                                        key={`past-${stop.properties.stop_sequence || idx}`}
                                        stop={stop}
                                        routeName={routeName}
                                        isPast={true}
                                        effectiveSequence={currentSequence}
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
                            .filter(stop => Number(stop.properties.stop_sequence) >= (currentSequence ?? 0))
                            .map((stop, idx: number) => (
                                <StopTimelineItem
                                    key={`future-${stop.properties.stop_sequence || idx}`}
                                    stop={stop}
                                    routeName={routeName}
                                    isPast={hasEnded}
                                    effectiveSequence={currentSequence}
                                    nextStopSequence={nextStopSequence}
                                    delay={delay}
                                    isFirstTransfer={Number(stop.properties.stop_sequence) === firstTransferSequence}
                                    isLastStop={Number(stop.properties.stop_sequence) === lastStopSequence}
                                    exitKind={journeyMark(Number(stop.properties.stop_sequence), journey)}
                                    isOnJourney={!hasEnded && isOnJourney(Number(stop.properties.stop_sequence), journey)}
                                    onOpenStop={openStop}
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
