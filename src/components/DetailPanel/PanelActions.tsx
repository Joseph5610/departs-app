import { useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Share2, MoreHorizontal, MessageSquareHeart, Star, Clock, ArrowDownAz, Monitor } from 'lucide-react';
import { paths } from '@/lib/routes';
import { useShare, useShareTrip } from '@/hooks/features/useShare';
import { useQueryClient } from '@tanstack/react-query';
import type { DeparturesResponse } from '@/hooks/data/useDepartures';
import { exitArrival } from '@/domain/rides';
import { nextDepartures } from '@/domain/departures';
import { useRideStore } from '@/state/rideStore';
import { useSelectedStop } from '@/hooks/derived/useSelectedStop';
import { useSelectedVehicle } from '@/hooks/derived/useSelectedVehicle';
import { useUiStore } from '@/state/uiStore';
import { usePreferencesStore } from '@/state/preferencesStore';
import { BOARD_CONFIG, DEPARTURES_CONFIG, PREFERENCES_LIMITS } from '@/config/constants';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouteParams } from '@/hooks/useRouteParams';
import { queryKeys } from '@/lib/queryKeys';

/**
 * PanelActions
 *
 * Header actions for the selected stop or vehicle. A vehicle shows share next to the menu; a stop
 * shows its favorite toggle there and moves share, departure sort and the official board into the menu.
 */
interface PanelActionsProps {
    /** Bordered chip buttons for the stop action row instead of ghost header buttons. */
    chips?: boolean;
}

export const PanelActions = memo(({ chips }: PanelActionsProps) => {
    const { t } = useTranslation();
    const { share } = useShare();
    const shareTrip = useShareTrip();
    const queryClient = useQueryClient();
    const ride = useRideStore(s => s.ride);
    const selectedStop = useSelectedStop();
    const selectedVehicle = useSelectedVehicle();
    const { setIsFeedbackOpen } = useUiStore(s => s.actions);
    const favoriteStops = usePreferencesStore(s => s.favoriteStops);
    const departureSort = usePreferencesStore(s => s.departureSort);
    const { toggleFavorite, setDepartureSort } = usePreferencesStore(s => s.actions);

    const routeName = selectedVehicle?.route_short_name;
    const tripId = selectedVehicle?.gtfs_trip_id;
    const vehicleId = selectedVehicle?.vehicle_id;
    const stopId = tripId ? undefined : selectedStop?.stop_id;
    const stopName = selectedStop?.stop_name;
    const boardCity = usePreferencesStore(s => s.selectedCity);
    const routeStopId = useRouteParams().stopId;

    const handleShare = useCallback(() => {
        if (tripId) {
            const exit = ride?.tripId === tripId
                ? exitArrival(selectedVehicle?.stop_times?.features ?? [], ride.exitSequence, selectedVehicle?.delay)
                : null;
            shareTrip({
                tripId,
                vehicleId,
                line: String(routeName ?? ''),
                headsign: selectedVehicle?.trip_headsign ?? '',
                delaySeconds: selectedVehicle?.delay,
                ride: exit && ride ? { exitSequence: ride.exitSequence, stopName: exit.stopName, time: exit.time } : undefined,
            });
        } else if (stopId) {
            const now = Date.now();
            // Read at tap time, so the panel doesn't re-render with every departures refresh.
            const departures = queryClient.getQueryData<DeparturesResponse | null>(queryKeys.departures(boardCity, routeStopId ?? stopId ?? null))?.departures ?? [];
            const next = nextDepartures(departures, DEPARTURES_CONFIG.SHARE_SUMMARY_COUNT, true)
                .map(dep => {
                    const mins = Math.floor((Date.parse(dep.timestamp) - now) / 60_000);
                    return mins < 1 ? t('share.stopNow', { line: dep.line }) : t('share.stopIn', { line: dep.line, count: mins });
                });
            share({
                title: t('map.departures.shareTitle', { name: stopName }),
                text: next.length > 0 ? t('share.stop', { name: stopName, list: next.join(', ') }) : t('map.departures.shareText', { name: stopName }),
                stopId
            });
        }
    }, [share, shareTrip, t, tripId, vehicleId, routeName, stopId, stopName, selectedVehicle, ride, queryClient, boardCity, routeStopId]);

    if (!tripId && !stopId) return null;

    const chipClassName = chips ? 'size-7 rounded-full border border-border/50 bg-card shadow-sm' : undefined;
    const isFavorite = !!stopId && favoriteStops.includes(stopId);
    const handleToggleFavorite = () => {
        if (!stopId) return;
        if (!isFavorite && favoriteStops.length >= PREFERENCES_LIMITS.FAVORITE_STOPS) {
            toast.error(t('toasts.favoritesLimitReached'));
            return;
        }
        toggleFavorite(stopId);
    };

    return (
        <>
            {stopId ? (
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleToggleFavorite}
                    aria-label={isFavorite ? t('map.departures.removeFromFavorites') : t('map.departures.addToFavorites')}
                    aria-pressed={isFavorite}
                    data-testid="favorite-btn"
                    className={cn("shrink-0 text-muted-foreground", chipClassName, isFavorite && "text-favorite hover:text-favorite-hover")}
                >
                    <Star size={chips ? 14 : 18} fill={isFavorite ? 'currentColor' : 'none'} strokeWidth={1.5} />
                </Button>
            ) : (
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleShare}
                    aria-label={t('common.share')}
                    data-testid="share-btn"
                    className="shrink-0 text-muted-foreground"
                >
                    <Share2 size={18} strokeWidth={1.5} />
                </Button>
            )}
            <DropdownMenu>
                <DropdownMenuTrigger render={
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('common.moreOptions')}
                        data-testid="more-options-btn"
                        className={cn("shrink-0 text-muted-foreground", chipClassName)}
                    >
                        <MoreHorizontal size={chips ? 16 : 20} strokeWidth={1.5} />
                    </Button>
                } />
                <DropdownMenuContent align="end" className="w-56">
                    {stopId && (
                        <>
                            <DropdownMenuGroup>
                                <DropdownMenuLabel>{t('map.departures.sort')}</DropdownMenuLabel>
                                <DropdownMenuRadioGroup value={departureSort} onValueChange={(value) => setDepartureSort(value as 'line' | 'departure')}>
                                    <DropdownMenuRadioItem value="departure">
                                        <Clock size={14} className="mr-2" strokeWidth={1.5} />
                                        {t('map.departures.sortByDeparture')}
                                    </DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="line">
                                        <ArrowDownAz size={14} className="mr-2" strokeWidth={1.5} />
                                        {t('map.departures.sortByLine')}
                                    </DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem render={<div data-testid="share-btn" onClick={handleShare} />} closeOnClick={false}>
                                <Share2 size={14} className="mr-2" strokeWidth={1.5} />
                                {t('common.share')}
                            </DropdownMenuItem>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger data-testid="board-btn">
                                    <Monitor size={14} className="mr-2" strokeWidth={1.5} />
                                    {t('board.open')}
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    {BOARD_CONFIG.WALK_OPTIONS_MIN.map(mins => (
                                        <DropdownMenuItem
                                            key={mins}
                                            data-testid={`board-walk-${mins}`}
                                            render={<a href={paths.board(boardCity, stopId, mins)} target="_blank" rel="noopener noreferrer" className="cursor-pointer" />}
                                        >
                                            {mins === 0 ? t('board.noWalk') : t('board.withWalk', { count: mins })}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        </>
                    )}
                    <DropdownMenuItem render={<div onClick={() => setIsFeedbackOpen(true)} />}>
                        <MessageSquareHeart size={14} className="mr-2" strokeWidth={1.5} />
                        {t('feedback.title')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
});

PanelActions.displayName = 'PanelActions';
