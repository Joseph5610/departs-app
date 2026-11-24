import { useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Share, MoreHorizontal, MessageSquareHeart, Star, Clock, ArrowDownAz, Monitor } from 'lucide-react';
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
import { cn } from '@/lib/cn';
import { ButtonTooltip } from '@/components/ButtonTooltip';
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
import { useStops } from '@/hooks/data/useStops';
import { favoriteStopsIn, pinsOf } from '@/domain/stops';
import { queryKeys } from '@/lib/queryKeys';
import { ExternalLinkIcon } from '@/components/ExternalLinkIcon';

const TOOLBAR_FOLD = 'duration-400 ease-[cubic-bezier(.32,.72,0,1)]';

interface ToolbarButtonProps extends React.ComponentProps<typeof Button> {
    label: string;
    /** Folded away while the list scrolls; the menu then offers what it did. */
    isFolded?: boolean;
}

/** One round button of the panel toolbar, with its tooltip. */
const ToolbarButton = ({ label, isFolded, className, ...props }: ToolbarButtonProps) => (
    <ButtonTooltip label={label}>
        <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            {...(isFolded && { tabIndex: -1, 'aria-hidden': true })}
            className={cn(
                "relative mx-0.5 size-10 shrink-0 rounded-full text-foreground after:absolute after:-inset-0.5 transition-[width,margin,opacity,background-color] duration-200 [&_svg]:size-4.75",
                isFolded !== undefined && TOOLBAR_FOLD,
                isFolded && "mx-0 w-0 overflow-hidden opacity-0",
                className
            )}
            {...props}
        />
    </ButtonTooltip>
);

/**
 * The floating toolbar of a stop board or a trip, on every device: a stop's favourite, share and the menu
 * (departure sort, the official board, feedback). While the list scrolls it folds to the menu, which then offers the rest.
 */
interface PanelActionsProps {
    /** Folded to its menu button while the list scrolls. */
    collapsed?: boolean;
}

export const PanelActions = memo(({ collapsed = false }: PanelActionsProps) => {
    const { t } = useTranslation();
    const { share } = useShare();
    const shareTrip = useShareTrip();
    const queryClient = useQueryClient();
    const trips = useRideStore(s => s.trips);
    const selectedStop = useSelectedStop();
    const selectedVehicle = useSelectedVehicle();
    const { setIsFeedbackOpen } = useUiStore(s => s.actions);
    const favoriteStops = usePreferencesStore(s => s.favoriteStops);
    const departureSort = usePreferencesStore(s => s.departureSort);
    const { toggleFavorite, removeFavoriteStops, setDepartureSort } = usePreferencesStore(s => s.actions);
    const { model } = useStops();

    const routeName = selectedVehicle?.route_short_name;
    const tripId = selectedVehicle?.gtfs_trip_id;
    const vehicleId = selectedVehicle?.vehicle_id;
    const stopId = tripId ? undefined : selectedStop?.board?.id ?? selectedStop?.id;
    const stopName = selectedStop?.board?.name;
    const departuresId = selectedStop?.departuresId ?? null;
    const boardCity = usePreferencesStore(s => s.selectedCity);

    const handleShare = useCallback(() => {
        if (tripId) {
            // A trip ridden to its end has no exit of the user's to share.
            const ride = trips.find(trip => trip.tripId === tripId && !trip.toEnd);
            const exit = ride
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
            const departures = queryClient.getQueryData<DeparturesResponse | null>(queryKeys.departures(boardCity, departuresId))?.departures ?? [];
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
    }, [share, shareTrip, t, tripId, vehicleId, routeName, stopId, stopName, selectedVehicle, trips, queryClient, boardCity, departuresId]);

    if (!tripId && !stopId) return null;

    // A stop pinned under an older id (an alias, a pre-stops.json PID id) counts as pinned, and unpinning drops every such id.
    const cityPins = favoriteStopsIn(favoriteStops, boardCity);
    const pins = stopId ? pinsOf(model, cityPins, stopId) : [];
    const isFavorite = pins.length > 0;
    const handleToggleFavorite = () => {
        if (!stopId) return;
        if (isFavorite) {
            removeFavoriteStops(pins);
            return;
        }
        if (cityPins.length >= PREFERENCES_LIMITS.FAVORITE_STOPS) {
            toast.error(t('toasts.favoritesLimitReached'));
            return;
        }
        toggleFavorite({ city: boardCity, stopId });
    };

    return (
        <div
            data-testid="sheet-toolbar"
            className={cn(
                "glassy max-md:fixed! md:absolute! bottom-[max(1rem,calc(env(safe-area-inset-bottom,0px)-0.375rem))] z-20 flex h-12 items-center justify-end rounded-full px-0.5 transition-[width,right] duration-450 ease-[cubic-bezier(.32,.72,0,1)]",
                collapsed ? "right-4 w-12" : stopId ? "right-[calc(50%-4.25rem)] w-34" : "right-[calc(50%-2.875rem)] w-23"
            )}
        >
            {stopId && (
                <ToolbarButton
                    label={isFavorite ? t('map.departures.removeFromFavorites') : t('map.departures.addToFavorites')}
                    isFolded={collapsed}
                    onClick={handleToggleFavorite}
                    aria-pressed={isFavorite}
                    data-testid="favorite-btn"
                    className={cn(isFavorite && "text-favorite hover:text-favorite-hover")}
                >
                    <Star fill={isFavorite ? 'currentColor' : 'none'} strokeWidth={1.75} />
                </ToolbarButton>
            )}
            <ToolbarButton label={t('common.share')} isFolded={collapsed} onClick={handleShare} data-testid="share-btn">
                <Share strokeWidth={1.75} />
            </ToolbarButton>
            <DropdownMenu>
                <DropdownMenuTrigger render={
                    <ToolbarButton label={t('common.moreOptions')} data-testid="more-options-btn">
                        <MoreHorizontal strokeWidth={1.75} />
                    </ToolbarButton>
                } />
                <DropdownMenuContent align="end" className="w-68">
                    {/* The folded toolbar shows only this menu, so it takes over the buttons that folded away. */}
                    {collapsed && (
                        <>
                            <DropdownMenuGroup>
                                {stopId && (
                                    <DropdownMenuItem render={<div data-testid="menu-favorite" onClick={handleToggleFavorite} />}>
                                        <Star size={14} strokeWidth={1.75} fill={isFavorite ? 'currentColor' : 'none'} className={cn(isFavorite && "text-favorite")} />
                                        {isFavorite ? t('map.departures.removeFromFavorites') : t('map.departures.addToFavorites')}
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem render={<div data-testid="menu-share" onClick={handleShare} />} closeOnClick={false}>
                                    <Share size={14} strokeWidth={1.75} />
                                    {t('common.share')}
                                </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                        </>
                    )}
                    {stopId && (
                        <>
                            <DropdownMenuGroup>
                                <DropdownMenuLabel>{t('map.departures.sort')}</DropdownMenuLabel>
                                <DropdownMenuRadioGroup value={departureSort} onValueChange={(value) => setDepartureSort(value as 'line' | 'departure')}>
                                    <DropdownMenuRadioItem value="departure">
                                        <Clock size={14} strokeWidth={1.75} />
                                        {t('map.departures.sortByDeparture')}
                                    </DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="line">
                                        <ArrowDownAz size={14} strokeWidth={1.75} />
                                        {t('map.departures.sortByLine')}
                                    </DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger data-testid="board-btn">
                                    <Monitor size={14} strokeWidth={1.75} />
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
                                            <ExternalLinkIcon variant="inline" className="ml-auto text-muted-foreground" />
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        </>
                    )}
                    <DropdownMenuItem render={<div onClick={() => setIsFeedbackOpen(true)} />}>
                        <MessageSquareHeart size={14} strokeWidth={1.75} />
                        {t('feedback.title')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
});

PanelActions.displayName = 'PanelActions';
