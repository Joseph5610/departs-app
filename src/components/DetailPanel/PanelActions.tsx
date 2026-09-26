import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Share2, MoreHorizontal, MessageSquareHeart, ExternalLink, Star, Clock, ArrowDownAz } from 'lucide-react';
import { useShare } from '../../hooks/features/useShare';
import { useSelectedStop } from '../../hooks/derived/useSelectedStop';
import { useSelectedVehicle } from '../../hooks/derived/useSelectedVehicle';
import { useCityConfig } from '../../hooks/data/useCities';
import { useUiStore } from '../../state/uiStore';
import { usePreferencesStore } from '../../state/preferencesStore';
import { PREFERENCES_LIMITS } from '../../config/constants';
import { cn } from '@/lib/utils';
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
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * PanelActions
 *
 * Header actions for the selected stop or vehicle. A vehicle shows share next to the menu; a stop
 * shows its favorite toggle there and moves share, departure sort and the official board into the menu.
 */
export const PanelActions: React.FC = React.memo(() => {
    const { t } = useTranslation();
    const { share } = useShare();
    const selectedStop = useSelectedStop();
    const selectedVehicle = useSelectedVehicle();
    const { virtualTableUrl } = useCityConfig();
    const { setIsFeedbackOpen } = useUiStore(s => s.actions);
    const favoriteStops = usePreferencesStore(s => s.favoriteStops);
    const departureSort = usePreferencesStore(s => s.departureSort);
    const { toggleFavorite, setDepartureSort } = usePreferencesStore(s => s.actions);

    const routeName = selectedVehicle?.route_short_name;
    const tripId = selectedVehicle?.gtfs_trip_id;
    const vehicleId = selectedVehicle?.vehicle_id;
    const stopId = tripId ? undefined : selectedStop?.stop_id;
    const stopName = selectedStop?.stop_name;

    const handleShare = useCallback(() => {
        if (tripId) {
            share({
                title: t('map.vehicleDetails.shareTitle', { line: routeName }),
                text: t('map.vehicleDetails.shareText', { line: routeName }),
                tripId,
                vehicleId: vehicleId || undefined
            });
        } else if (stopId) {
            share({
                title: t('map.departures.shareTitle', { name: stopName }),
                text: t('map.departures.shareText', { name: stopName }),
                stopId
            });
        }
    }, [share, t, tripId, vehicleId, routeName, stopId, stopName]);

    if (!tripId && !stopId) return null;

    const isFavorite = !!stopId && favoriteStops.includes(stopId);
    const handleToggleFavorite = () => {
        if (!stopId) return;
        if (!isFavorite && favoriteStops.length >= PREFERENCES_LIMITS.FAVORITE_STOPS) {
            toast.error(t('toasts.favoritesLimitReached'));
            return;
        }
        toggleFavorite(stopId);
    };

    const officialBoardUrl = virtualTableUrl && stopId
        ? `${virtualTableUrl}${stopId.replace(/,/g, ';')}&title=${encodeURIComponent(stopName || '')}`
        : null;

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
                    className={cn("shrink-0 text-muted-foreground", isFavorite && "text-amber-500 hover:text-amber-400")}
                >
                    <Star size={18} fill={isFavorite ? 'currentColor' : 'none'} strokeWidth={1.5} />
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
                        className="shrink-0 text-muted-foreground"
                    >
                        <MoreHorizontal size={20} strokeWidth={1.5} />
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
                        </>
                    )}
                    {officialBoardUrl && (
                        <DropdownMenuItem render={<a href={officialBoardUrl} target="_blank" rel="noopener noreferrer" className="cursor-pointer" />}>
                            <ExternalLink size={14} className="mr-2" strokeWidth={1.5} />
                            {t('map.departures.officialBoard')}
                        </DropdownMenuItem>
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
