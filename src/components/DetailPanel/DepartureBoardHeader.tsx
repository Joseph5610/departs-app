
import React, { useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownAz, Clock, Star, MapPin, Share2 } from 'lucide-react';
import { useMap } from '../../hooks/useMap';
import { calculateDistance } from '../../utils/transitLogic';
import { useShare } from '../../hooks/useShare';
import { HStack, Surface } from '@/components/ui/layout';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

/**
 * DepartureBoardHeader
 * 
 * Sticky subheader for the departure board.
 * Contains distance info and action buttons (Share, Favorite, Sort).
 */
export const DepartureBoardHeader = React.memo(() => {
    const { t } = useTranslation();
    const { state, actions } = useMap();
    const { share } = useShare();

    const { selectedStop, selectedVehicle, departureSort, userLocation, userSpeed, favoriteStops } = state;
    const { setDepartureSort, toggleFavorite } = actions;

    const showHeader = !!selectedStop && !selectedVehicle;
    const isFavorite = selectedStop ? favoriteStops.includes(selectedStop.stop_id) : false;

    const stopDistanceInfo = useMemo(() => {
        const coords = selectedStop?.coordinates;
        if (!coords || !userLocation) return null;
        const distance = calculateDistance(userLocation, coords);

        const isAtStop = distance < 20;
        const isMovingFast = userSpeed !== null && userSpeed > 4;

        return {
            distance: Math.round(distance),
            isAtStop,
            showCatchIndicator: distance < 750 && !isMovingFast
        };
    }, [selectedStop?.coordinates, userLocation, userSpeed]);

    const handleShare = useCallback(() => {
        if (selectedStop) {
            share({
                title: t('map.departures.shareTitle', { name: selectedStop.stop_name }),
                text: t('map.departures.shareText', { name: selectedStop.stop_name }),
                url: window.location.href
            });
        }
    }, [selectedStop, share, t]);

    if (!showHeader) return null;

    return (
        <div className="px-6 pb-2 shrink-0 flex flex-col gap-3">
            {stopDistanceInfo && (stopDistanceInfo.showCatchIndicator || stopDistanceInfo.isAtStop) && (
                <Surface variant="tinted" padding="xs" className="flex flex-row items-center gap-2 border-white/10! px-3 py-1.5 self-start">
                    <MapPin size={12} className="text-muted-foreground/60" />
                    <span className="font-medium text-foreground text-[11px]">
                        {stopDistanceInfo.isAtStop
                            ? t('map.departures.atStop')
                            : t('map.departures.distance', {
                                distance: stopDistanceInfo.distance,
                                time: Math.ceil(stopDistanceInfo.distance / 60)
                            })}
                    </span>
                </Surface>
            )}

            <HStack justify="between">
                <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest">
                    {t('map.departures.upcoming')}
                </span>
                <HStack gap={2}>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={handleShare}
                        className="h-8 w-8 rounded-xl bg-muted/30 border-border text-muted-foreground hover:text-foreground"
                    >
                        <Share2 size={14} />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => selectedStop && toggleFavorite(selectedStop.stop_id)}
                        className={cn(
                            "h-8 w-8 rounded-xl transition-all",
                            isFavorite ? "bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500/20" : "bg-muted/30 border-border text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
                    </Button>

                    <ToggleGroup
                        value={[departureSort]}
                        onValueChange={(val) => val?.[0] && setDepartureSort(val[0] as 'line' | 'departure')}
                        className="bg-muted/30 p-0.5 rounded-xl border border-border h-8"
                    >
                        <ToggleGroupItem
                            value="line"
                            className="h-full px-2 rounded-lg data-[state=on]:bg-accent data-[state=on]:text-foreground data-[state=on]:shadow-sm text-muted-foreground hover:text-foreground transition-all"
                            title={t('map.departures.sortByLine')}
                        >
                            <ArrowDownAz size={14} />
                        </ToggleGroupItem>
                        <ToggleGroupItem
                            value="departure"
                            className="h-full px-2 rounded-lg data-[state=on]:bg-accent data-[state=on]:text-foreground data-[state=on]:shadow-sm text-muted-foreground hover:text-foreground transition-all"
                            title={t('map.departures.sortByDeparture')}
                        >
                            <Clock size={14} />
                        </ToggleGroupItem>
                    </ToggleGroup>
                </HStack>
            </HStack>
        </div>
    );
});

DepartureBoardHeader.displayName = 'DepartureBoardHeader';
