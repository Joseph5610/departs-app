import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing, Check, ChevronUp, Share2, UserRound, X } from 'lucide-react';
import { cn } from 'cn';
import { navigate } from '@/lib/history';
import { paths } from '@/lib/routes';
import { useNow } from '@/hooks/useNow';
import { useRideStatus } from '@/hooks/derived/useRide';
import type { Ride, RideKind, RideStatus } from '@/types';
import { followedRideFirst, isRideShown } from '@/domain/rides';
import { useRideAlerts } from '@/hooks/features/useRideAlerts';
import { useRideStore } from '@/state/rideStore';
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
    const { endRide, unfollow } = useRideStore(s => s.actions);
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
        <div
            data-testid={isFollowed ? 'follow-bar' : 'ride-bar'}
            className={cn(
                "pointer-events-auto relative overflow-hidden rounded-2xl w-full md:w-[21rem] animate-in fade-in slide-in-from-top-2 duration-300 transition-colors",
                isAccent ? "bg-primary text-primary-foreground shadow-lg" : "glassy"
            )}
        >
            <div className="flex items-center gap-1 pl-2.5 pr-1.5 py-2">
                <button
                    type="button"
                    onClick={() => navigate(tripPath)}
                    aria-label={t(isFollowed ? 'share.openFollowed' : 'ride.open')}
                    className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                    <span className="relative shrink-0">
                        {routeName && <LineBadge name={routeName} routeColor={routeColor} size="lg" />}
                        {isFollowed && (
                            <span className="absolute -bottom-1.5 -right-1.5 grid place-items-center size-4 rounded-full bg-background text-foreground ring-1 ring-border">
                                <UserRound size={10} strokeWidth={2.5} />
                            </span>
                        )}
                    </span>
                    <span className="flex flex-col min-w-0 flex-1 leading-tight">
                        <span className={cn("text-[10px] font-bold uppercase tracking-wider truncate", isAccent ? "text-primary-foreground/80" : "text-primary")}>{kicker}</span>
                        <span className="text-sm font-bold truncate">{exitStopName}</span>
                        {(showStopsLeft || showArrival) && (
                            <span className={cn("text-[11px] tabular-nums truncate", subtle)}>
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
                                <span className={cn("block text-[10px] font-semibold mt-0.5", subtle)}>min</span>
                            </>
                        )}
                    </span>
                </button>
                <span className={cn("w-px self-stretch my-1 mx-0.5", isAccent ? "bg-primary-foreground/20" : "bg-border")} aria-hidden="true" />
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
                                ride: { exitSequence: ride.exitSequence, stopName: exitStopName, time: arrivalTime },
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
                        onClick={() => (isFollowed ? unfollow(true) : endRide())}
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
        </div>
    );
};


/**
 * The user's ride and a followed ride above the map. Both shown, they stack with the more urgent one in front
 * (the user's own unless only the followed ride is at its next stop or arrived) and fan out on a tap.
 */
export const RideBar = () => {
    const { t } = useTranslation();
    const now = useNow();
    const ride = useRideStore(s => s.ride);
    const followed = useRideStore(s => s.followed);
    const ownStatus = useRideStatus(ride, now);
    const followedStatus = useRideStatus(followed, now);
    // Alerts live here, not in the bars: a bar remounts when the stack reorders, which would forget the last phase.
    useRideAlerts(ownStatus, 'own');
    useRideAlerts(followedStatus, 'followed');
    const [isExpanded, setIsExpanded] = useState(false);
    const liveStatusHidden = useLiveStatusYieldsToRides();
    const { stopId, vehicleId, isStatsRoute, isFavoritesRoute } = useRouteParams();
    const isSidebarOpen = !!stopId || !!vehicleId || isStatsRoute || isFavoritesRoute;

    if (!ride && !followed) return null;

    const own = ride && <RideBarItem key="own" ride={ride} kind="own" status={ownStatus} />;
    const friend = followed && <RideBarItem key="followed" ride={followed} kind="followed" status={followedStatus} />;
    const followedFirst = followedRideFirst(ownStatus, followedStatus);
    const [front, back] = followedFirst ? [friend, own] : [own, friend];
    const isStack = isRideShown(ownStatus) && isRideShown(followedStatus);

    return (
        <div
            className={cn(
                // On phones the bars keep clear of the map controls on the right; from md they centre over the map.
                "absolute z-50 pointer-events-none top-0 left-4 right-[4.75rem] flex flex-col items-center md:right-auto md:left-1/2 md:-translate-x-1/2 md:w-max",
                "transition-all duration-300 ease-in-out md:pt-0",
                liveStatusHidden
                    ? "pt-[calc(4.75rem+env(safe-area-inset-top,0))] md:top-[calc(5.25rem+env(safe-area-inset-top,0))]"
                    : "pt-[calc(7rem+env(safe-area-inset-top,0))] md:top-[calc(7.5rem+env(safe-area-inset-top,0))]",
                isSidebarOpen && "md:left-(--visible-center-x)"
            )}
        >
            {!isStack ? (
                <div className="flex flex-col items-center gap-1.5 w-full">{front}{back}</div>
            ) : isExpanded ? (
                <div className="flex flex-col items-center gap-1.5 w-full">
                    {front}
                    {back}
                    <button
                        type="button"
                        onClick={() => setIsExpanded(false)}
                        aria-label={t('ride.collapseRides')}
                        className="pointer-events-auto grid place-items-center h-5 w-12 rounded-full glassy cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                        <ChevronUp size={14} strokeWidth={2} />
                    </button>
                </div>
            ) : (
                <div className="relative w-full md:w-[21rem]">
                    <span className="absolute inset-x-4 -bottom-2.5 h-8 rounded-b-2xl bg-card border border-border shadow-md" aria-hidden="true" />
                    <div className="relative z-10 flex justify-center">{front}</div>
                    <button
                        type="button"
                        onClick={() => setIsExpanded(true)}
                        aria-label={t('ride.expandRides')}
                        className="absolute inset-x-3 -bottom-3 h-4 z-20 pointer-events-auto rounded-b-2xl cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    />
                </div>
            )}
        </div>
    );
};
