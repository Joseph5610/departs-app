import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing, Check, ChevronDown, ChevronUp, Share2, UserRound, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { RIDE_CONFIG } from '@/config/constants';
import { navigate } from '@/lib/history';
import { paths } from '@/lib/routes';
import { useNow } from '@/hooks/useNow';
import { useMyTripStatus } from '@/hooks/derived/useRide';
import { useBoardingAlert } from '@/hooks/features/useBoardingAlert';
import type { BoardingStatus, MyTrip, MyTripStatus, Ride, RideKind, RideStatus } from '@/types';
import { byUrgency, followedUrgency, isRideShown, isTripExpired, tripUrgency } from '@/domain/rides';
import { useRideAlerts } from '@/hooks/features/useRideAlerts';
import { useRidePush } from '@/hooks/features/useRidePush';
import { useRideStore } from '@/state/rideStore';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useShareTrip } from '@/hooks/features/useShare';
import { useRouteParams } from '@/hooks/useRouteParams';
import { useLiveStatusYieldsToRides } from '@/hooks/derived/useSystemStatus';
import { LineBadge } from '@/components/LineBadge';
import { toast } from 'sonner';
import { notificationPermission, requestNotificationPermission } from '@/lib/notifications';

const iconButton = "shrink-0 grid place-items-center size-7 rounded-full cursor-pointer outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-primary/50";


/** One ride's bar: its exit stop, stops left and arrival; opens the trip. */
const RideBarItem = ({ ride, kind, status }: { ride: Ride; kind: RideKind; status: RideStatus | null }) => {
    const { t } = useTranslation();
    const { endTrip, unfollow } = useRideStore(s => s.actions);
    const shareTrip = useShareTrip();
    const [askNotifications, setAskNotifications] = useState(() => notificationPermission() === 'default');
    const enableNotifications = async () => {
        const outcome = await requestNotificationPermission();
        setAskNotifications(outcome === 'default');
        if (outcome === 'granted') toast.success(t('share.notificationsOn'));
        else toast(t(outcome === 'denied' ? 'share.notificationsBlocked' : 'share.notificationsNotShown'));
    };

    if (!status || status.phase === 'loading') return null;
    const { phase, exitStopName, stopsLeft, arrivalTime, routeName, routeColor, headsign, delay, minutesToArrival, progress } = status;
    const isFollowed = kind === 'followed';
    const isNext = phase === 'next';
    const isArrived = phase === 'arrived';
    const isAccent = isNext || isArrived;
    const delayMins = delay !== null ? Math.round(delay / 60) : 0;

    const kicker = phase === 'unavailable' ? t('ride.unavailable')
        : phase === 'waiting' ? t('ride.waiting')
        : isNext ? t('ride.kickerNext')
        : isArrived ? t(isFollowed ? 'share.kickerArrived' : 'ride.kickerArrived')
        : t(isFollowed ? 'share.kickerRiding' : 'ride.kickerRiding');
    const showStopsLeft = (phase === 'riding' || isNext) && stopsLeft !== null;
    const showArrival = !!arrivalTime && !isArrived;
    const arrivalClass = delayMins > 0 ? (isAccent ? "rounded px-1 bg-background/90 text-destructive" : "text-destructive")
        : delayMins < 0 ? (isAccent ? "rounded px-1 bg-background/90 text-sky-500" : "text-sky-500")
        : "";
    const isLive = !isArrived && phase !== 'unavailable';
    const tripPath = paths.trip(ride.city, ride.tripId, ride.vehicleId) + (isFollowed ? `?exit=${ride.exitSequence}` : '');
    const subtle = isAccent ? "text-primary-foreground/75" : "text-muted-foreground";

    return (
        <BarFrame testId={isFollowed ? 'follow-bar' : 'ride-bar'} isAccent={isAccent}>
            <div className="flex items-center gap-1 pl-2.5 pr-1.5 py-2">
                <BarMain onClick={() => navigate(tripPath)} label={t(isFollowed ? 'share.openFollowed' : 'ride.open')}>
                    <span className="relative shrink-0">
                        {routeName && <LineBadge name={routeName} routeColor={routeColor} size="lg" />}
                        {isFollowed && (
                            <span className="absolute -bottom-1.5 -right-1.5 grid place-items-center size-4 rounded-full bg-background text-foreground ring-1 ring-border">
                                <UserRound size={10} strokeWidth={2.5} />
                            </span>
                        )}
                    </span>
                    <span className="flex flex-col min-w-0 flex-1 leading-tight">
                        <span className={cn("micro-label truncate", isAccent ? "text-primary-foreground/80" : "text-primary")}>{kicker}</span>
                        <span className="text-sm font-bold truncate">{exitStopName}</span>
                        {(showStopsLeft || showArrival) && (
                            <span className={cn("text-caption tabular-nums truncate", subtle)}>
                                {showStopsLeft && t('ride.stopsLeft', { count: stopsLeft })}
                                {showStopsLeft && showArrival && ' · '}
                                {showArrival && (
                                    <>
                                        {t('ride.arrivesAtLabel')}{' '}
                                        <span className={cn("font-bold", arrivalClass || (isAccent ? "text-primary-foreground" : "text-foreground"))}>{arrivalTime}</span>
                                    </>
                                )}
                            </span>
                        )}
                    </span>
                    <span className="shrink-0 min-w-11 text-right leading-none tabular-nums">
                        {isArrived ? (
                            <Check size={22} strokeWidth={2.5} className="ml-auto" />
                        ) : minutesToArrival === null ? null : minutesToArrival === 0 ? (
                            <span className="text-sm font-black">{t('map.departures.now')}</span>
                        ) : (
                            <>
                                <span className="text-xl font-black">{minutesToArrival}</span>
                                <span className={cn("block text-label font-semibold mt-0.5", subtle)}>min</span>
                            </>
                        )}
                    </span>
                </BarMain>
                <BarDivider isAccent={isAccent} />
                <span className="flex flex-col gap-0.5">
                    {isFollowed && isLive && askNotifications ? (
                        <button
                            type="button"
                            onClick={() => { void enableNotifications(); }}
                            aria-label={t('share.notifyMe')}
                            title={t('share.notifyMe')}
                            data-testid="follow-notify"
                            className={iconButton}
                        >
                            <BellRing size={14} strokeWidth={2} />
                        </button>
                    ) : !isFollowed && isLive ? (
                        <button
                            type="button"
                            onClick={() => shareTrip({
                                city: ride.city,
                                tripId: ride.tripId,
                                vehicleId: ride.vehicleId,
                                line: routeName,
                                headsign,
                                // Under way the boarding is behind; a trip to its end has no exit of the user's to share.
                                ride: 'toEnd' in ride && ride.toEnd ? undefined : { exitSequence: ride.exitSequence, stopName: exitStopName, time: arrivalTime },
                            })}
                            aria-label={t('share.shareRide')}
                            data-testid="ride-share"
                            className={iconButton}
                        >
                            <Share2 size={14} strokeWidth={2} />
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={() => (isFollowed ? unfollow(true) : endTrip(ride.tripId))}
                        aria-label={t(isFollowed ? 'share.stopWatching' : 'ride.end')}
                        className={iconButton}
                    >
                        <X size={14} strokeWidth={2} />
                    </button>
                </span>
            </div>
            {progress !== null && !isArrived && (
                <span
                    className={cn("absolute left-0 bottom-0 h-[3px] rounded-r-full transition-[width] duration-700", isAccent ? "bg-primary-foreground/70" : "bg-primary")}
                    style={{ width: `${Math.round(progress * 100)}%` }}
                    aria-hidden="true"
                />
            )}
        </BarFrame>
    );
};

/** A bar's box above the map: glassy, or filled with the brand colour while it needs attention. */
const BarFrame = ({ testId, isAccent, children }: { testId: string; isAccent: boolean; children: React.ReactNode }) => (
    <div
        data-testid={testId}
        className={cn(
            "pointer-events-auto relative overflow-hidden rounded-2xl w-full md:w-[21rem] animate-in fade-in slide-in-from-top-2 duration-300 transition-colors",
            isAccent ? "bg-primary text-primary-foreground shadow-lg" : "glassy"
        )}
    >
        {children}
    </div>
);

/** A bar's main tap target: badge, texts and the minutes at its end. */
const BarMain = ({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) => (
    <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
        {children}
    </button>
);

const BarDivider = ({ isAccent }: { isAccent: boolean }) => (
    <span className={cn("w-px self-stretch my-1 mx-0.5", isAccent ? "bg-primary-foreground/20" : "bg-border")} aria-hidden="true" />
);

/** A My trip before boarding: the stop, the expected departure and the minutes left; opens the trip, like a ride's bar. */
const BoardingBarItem = ({ status, kind }: { status: BoardingStatus; kind: RideKind }) => {
    const { t } = useTranslation();
    const { endTrip, unfollow } = useRideStore(s => s.actions);
    const shareTrip = useShareTrip();
    const { trip, stopName, departureTime, minutes, isSoon, routeName, routeColor, headsign, arrivalTime } = status;
    const isFollowed = kind === 'followed';
    const subtle = isSoon ? "text-primary-foreground/75" : "text-muted-foreground";
    return (
        <BarFrame testId={isFollowed ? 'follow-boarding-bar' : 'boarding-bar'} isAccent={isSoon}>
            <div className="flex items-center gap-1 pl-2.5 pr-1.5 py-2">
                <BarMain onClick={() => navigate(paths.trip(trip.city, trip.tripId, trip.vehicleId))} label={t('ride.open')}>
                    {routeName && <LineBadge name={routeName} routeColor={routeColor} size="lg" />}
                    <span className="flex flex-col min-w-0 flex-1 leading-tight">
                        <span className={cn("micro-label truncate", isSoon ? "text-primary-foreground/80" : "text-primary")}>{t(isFollowed ? 'share.kickerBoard' : 'myTrip.kickerBoard')}</span>
                        <span className="text-sm font-bold truncate">{stopName}</span>
                        <span className={cn("text-caption tabular-nums truncate", subtle)}>{t('myTrip.departs', { time: departureTime })}</span>
                    </span>
                    <span className="shrink-0 min-w-11 text-right leading-none tabular-nums">
                        {minutes === 0 ? (
                            <span className="text-sm font-black">{t('map.departures.now')}</span>
                        ) : (
                            <>
                                <span className="text-xl font-black">{minutes}</span>
                                <span className={cn("block text-label font-semibold mt-0.5", subtle)}>min</span>
                            </>
                        )}
                    </span>
                </BarMain>
                <BarDivider isAccent={isSoon} />
                <span className="flex flex-col gap-0.5">
                    {!isFollowed && (
                        <button
                            type="button"
                            onClick={() => shareTrip({
                                city: trip.city, tripId: trip.tripId, vehicleId: trip.vehicleId, line: routeName, headsign,
                                board: { sequence: trip.board?.sequence ?? 0, stopName, time: departureTime },
                                ride: trip.toEnd ? undefined : { exitSequence: trip.exitSequence, stopName: trip.exitStopName ?? '', time: arrivalTime },
                            })}
                            aria-label={t('share.shareTrip')}
                            className={iconButton}
                        >
                            <Share2 size={14} strokeWidth={2} />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => (isFollowed ? unfollow(true) : endTrip(trip.tripId))}
                        aria-label={t(isFollowed ? 'share.stopWatching' : 'myTrip.end')}
                        className={iconButton}
                    >
                        <X size={14} strokeWidth={2} />
                    </button>
                </span>
            </div>
        </BarFrame>
    );
};

/**
 * One trip's alerts, apart from its bar (which remounts when the stack reorders) and keyed by the trip, so the phase
 * it last saw stays the trip's own when another trip ends and the slots shift.
 */
const TripAlerts = ({ trip, status }: { trip: MyTrip; status: MyTripStatus | null }) => {
    const { endTrip } = useRideStore(s => s.actions);
    const end = useCallback(() => endTrip(trip.tripId), [trip.tripId, endTrip]);
    const [sawBoarding, setSawBoarding] = useState(false);
    if (status?.phase === 'boarding' && !sawBoarding) setSawBoarding(true);
    useRideAlerts(status?.phase === 'riding' ? status.ride : null, 'own', { isOver: !status, end, silent: trip.toEnd, afterBoarding: sawBoarding });
    useBoardingAlert(status);
    return null;
};

/**
 * The user's trips and a followed ride above the map, most urgent in front (at the exit, then boarding soon); with
 * several they stack and fan out on a tap.
 */
export const RideBar = () => {
    const { t } = useTranslation();
    const now = useNow();
    // Another city's trips stay stored (and pushed by the server) but get no bar or polling until the user is back there.
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const allTrips = useRideStore(s => s.trips);
    const trips = useMemo(() => allTrips.filter(trip => trip.city === selectedCity), [allTrips, selectedCity]);
    const storedFollowed = useRideStore(s => s.followed);
    const followed = storedFollowed?.city === selectedCity ? storedFollowed : null;
    const { unfollow } = useRideStore(s => s.actions);
    // One status per slot, up to MY_TRIP_CONFIG.MAX_TRIPS, so the hooks keep their order.
    const first = trips[0] ?? null;
    const second = trips[1] ?? null;
    const third = trips[2] ?? null;
    const firstStatus = useMyTripStatus(first, now);
    const secondStatus = useMyTripStatus(second, now);
    const thirdStatus = useMyTripStatus(third, now);
    const followedStatus = useMyTripStatus(followed, now);
    // Trips long over by the clock go, wherever they are: another city's never get a status to end them.
    const { endTrip } = useRideStore(s => s.actions);
    useEffect(() => {
        for (const trip of allTrips) if (isTripExpired(trip, now)) endTrip(trip.tripId);
    }, [allTrips, now, endTrip]);
    const endFollow = useCallback(() => unfollow(true), [unfollow]);
    useRideAlerts(followedStatus?.phase === 'riding' ? followedStatus.ride : null, 'followed', { isOver: !!followed && !followedStatus, end: endFollow, silent: followed?.toEnd ?? false });
    useRidePush();
    const [isExpanded, setIsExpanded] = useState(false);
    /** Fanned out by a hovering mouse, which then folds them back on leaving; a tap keeps them open. */
    const openedByHover = useRef(false);
    const foldTimer = useRef<number | undefined>(undefined);
    useEffect(() => () => window.clearTimeout(foldTimer.current), []);
    const hoverOpen = (e: React.PointerEvent) => {
        if (e.pointerType !== 'mouse') return;
        window.clearTimeout(foldTimer.current);
        if (!isExpanded) {
            openedByHover.current = true;
            setIsExpanded(true);
        }
    };
    // A short delay, cancelled on coming back, so crossing the edge or a gap doesn't fold and reopen the stack.
    const hoverFold = (e: React.PointerEvent) => {
        if (e.pointerType !== 'mouse' || !openedByHover.current) return;
        window.clearTimeout(foldTimer.current);
        foldTimer.current = window.setTimeout(() => setIsExpanded(false), RIDE_CONFIG.STACK_FOLD_DELAY_MS);
    };
    const liveStatusHidden = useLiveStatusYieldsToRides();
    const { stopId, vehicleId, isStatsRoute, isFavoritesRoute } = useRouteParams();
    const isSidebarOpen = !!stopId || !!vehicleId || isStatsRoute || isFavoritesRoute;

    const alerts = [[first, firstStatus], [second, secondStatus], [third, thirdStatus]] as const;
    const tripAlerts = alerts.map(([trip, status]) => trip && <TripAlerts key={trip.tripId} trip={trip} status={status} />);

    const shown: { key: string; urgency: number; node: React.ReactNode }[] = [];
    for (const status of [firstStatus, secondStatus, thirdStatus]) {
        if (!status || (status.phase === 'riding' && !isRideShown(status.ride))) continue;
        shown.push({
            key: status.trip.tripId,
            urgency: tripUrgency(status),
            node: status.phase === 'boarding'
                ? <BoardingBarItem key={status.trip.tripId} status={status} kind="own" />
                : <RideBarItem key={status.trip.tripId} ride={status.trip} kind="own" status={status.ride} />,
        });
    }
    if (followed && followedStatus && (followedStatus.phase === 'boarding' || isRideShown(followedStatus.ride))) {
        shown.push({
            key: 'followed',
            urgency: followedUrgency(followedStatus),
            node: followedStatus.phase === 'boarding'
                ? <BoardingBarItem key="followed" status={followedStatus} kind="followed" />
                : <RideBarItem key="followed" ride={followed} kind="followed" status={followedStatus.ride} />,
        });
    }
    if (shown.length === 0) return <>{tripAlerts}</>;
    const [front, ...back] = byUrgency(shown).map(item => item.node);
    const isStack = shown.length > 1;

    return (
        <>
        {tripAlerts}
        <div
            className={cn(
                // On phones the bars span the top of the map; from md they centre over the map.
                "absolute z-50 pointer-events-none top-0 left-4 right-4 flex flex-col items-center md:right-auto md:left-1/2 md:-translate-x-1/2 md:w-max",
                "transition-all duration-300 ease-in-out md:pt-0",
                liveStatusHidden
                    ? "pt-[calc(var(--top-controls-gap)+env(safe-area-inset-top,0))] md:top-[calc(5.25rem+env(safe-area-inset-top,0))]"
                    : "pt-[calc(var(--top-controls-gap)+2.25rem+env(safe-area-inset-top,0))] md:top-[calc(7.5rem+env(safe-area-inset-top,0))]",
                isSidebarOpen && "md:left-(--visible-center-x)"
            )}
        >
            {/* One structure open or folded, so the front bar never remounts (and replays its entrance); the rest slide open under it. */}
            <div
                className={cn("relative flex w-full flex-col items-center md:w-[21rem]", isStack && "pointer-events-auto transition-[padding] duration-300 ease-out", isStack && !isExpanded && "pb-5")}
                onPointerEnter={isStack ? hoverOpen : undefined}
                onPointerLeave={isStack ? hoverFold : undefined}
            >
                <div className="relative z-10 flex w-full justify-center">{front}</div>
                {isStack && (
                    <>
                        <div
                            className={cn(
                                "grid w-full transition-[grid-template-rows,opacity,margin] duration-300 ease-out",
                                isExpanded ? "mt-1.5 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                            )}
                            inert={!isExpanded}
                        >
                            <div className="flex min-h-0 flex-col items-center gap-1.5 overflow-hidden">{back}</div>
                        </div>
                        {/* Folded, the bars behind peek out as a tab under the front one: tap (or hover) to fan them out. */}
                        <button
                            type="button"
                            onClick={() => { openedByHover.current = false; setIsExpanded(!isExpanded); }}
                            aria-label={t(isExpanded ? 'ride.collapseRides' : 'ride.expandRides')}
                            aria-expanded={isExpanded}
                            className={cn(
                                "flex cursor-pointer items-center justify-center gap-1 text-muted-foreground outline-none transition-all duration-300 ease-out hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50",
                                isExpanded
                                    ? "mt-1.5 h-5 w-12 rounded-full glassy"
                                    : "absolute inset-x-5 bottom-0 z-0 h-9 items-end rounded-b-2xl border border-t-0 border-border bg-card pb-1 shadow-md"
                            )}
                        >
                            {isExpanded ? <ChevronUp size={14} strokeWidth={2} /> : (
                                <>
                                    <span className="micro-label tabular-nums">+{back.length}</span>
                                    <ChevronDown size={12} strokeWidth={2.5} />
                                </>
                            )}
                        </button>
                    </>
                )}
            </div>
        </div>
        </>
    );
};
