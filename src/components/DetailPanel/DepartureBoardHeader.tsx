
import React, { useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownAz, Clock, Star, Share2 } from 'lucide-react';
import { useMap } from '../../hooks/useMap';
import { calculateDistance } from '../../utils/transitLogic';
import { useShare } from '../../hooks/useShare';
import { HStack, Surface, Box } from '@/components/ui/layout';
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
            time: Math.ceil(distance / 60),
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
        <div className="px-6 pb-4 shrink-0 flex flex-col gap-4">
            {stopDistanceInfo && (stopDistanceInfo.showCatchIndicator || stopDistanceInfo.isAtStop) && (
                <Surface variant="tinted" padding="none" className="flex flex-row items-center gap-2 border-white/10! px-3.5 py-2 self-start rounded-full bg-white/5 backdrop-blur-md">
                    <Box className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        stopDistanceInfo.isAtStop ? "bg-primary animate-pulse shadow-[0_0_8px_var(--color-primary)]" : "bg-muted-foreground/60"
                    )} />
                    <span className="font-bold text-foreground text-[10px] uppercase tracking-widest leading-none">
                        {stopDistanceInfo.isAtStop
                            ? t('map.departures.atStop')
                            : t('map.departures.distance', {
                                distance: stopDistanceInfo.distance,
                                count: stopDistanceInfo.time
                            })}
                    </span>
                </Surface>
            )}

            <HStack justify="between" align="center">
                <span className="text-muted-foreground/60 text-[10px] uppercase font-bold tracking-[0.2em]">
                    {t('map.departures.upcoming')}
                </span>
                <HStack gap={2}>
                    <Button
                        variant="tinted"
                        size="icon"
                        onClick={handleShare}
                        className="h-8 w-8 rounded-lg bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
                    >
                        <Share2 size={14} />
                    </Button>
                    <Button
                        variant="tinted"
                        size="icon"
                        onClick={() => selectedStop && toggleFavorite(selectedStop.stop_id)}
                        className={cn(
                            "h-8 w-8 rounded-lg transition-all border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20",
                            isFavorite && "bg-amber-500/10 border-amber-500/20! text-amber-500 hover:bg-amber-500/20!"
                        )}
                    >
                        <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
                    </Button>

                    <ToggleGroup
                        value={[departureSort]}
                        onValueChange={(val) => {
                            if (typeof val === 'string') {
                                setDepartureSort(val as 'line' | 'departure');
                            }
                        }}
                        className="bg-white/5 rounded-lg h-8 overflow-hidden border border-white/10"
                    >
                        <ToggleGroupItem
                            value="line"
                            className="h-full px-2.5 hover:bg-white/5 data-[state=on]:bg-white/10 data-[state=on]:text-primary"
                            title={t('map.departures.sortByLine')}
                        >
                            <ArrowDownAz size={16} />
                        </ToggleGroupItem>
                        <ToggleGroupItem
                            value="departure"
                            className="h-full px-2.5 hover:bg-white/5 data-[state=on]:bg-white/10 data-[state=on]:text-primary"
                            title={t('map.departures.sortByDeparture')}
                        >
                            <Clock size={16} />
                        </ToggleGroupItem>
                    </ToggleGroup>
                </HStack>
            </HStack>
        </div>
    );
});

DepartureBoardHeader.displayName = 'DepartureBoardHeader';
