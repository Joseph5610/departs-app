import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, Loader2, Train } from 'lucide-react';
import { navigate } from '../../../lib/history';
import { paths } from '../../../lib/routes';
import { usePreferencesStore } from '../../../state/preferencesStore';
import { useMapMetadataStore } from '../../../state/mapMetadataStore';
import { useGeolocationStore } from '../../../state/geolocationStore';
import { getStopDistanceInfo, formatStopDistance } from '../../../hooks/derived/useStopDistance';
import { format, parseISO } from 'date-fns';
import { formatDelay } from '../../../utils/dateUtils';
import { cn } from 'cn';
import { Countdown } from '../DepartureBoard/Countdown';
import { LineBadge } from '../../LineBadge';
import { IconTooltip } from '../../IconTooltip';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardTitle, CardContent } from '../../ui/card';
import {
    MAP_CAMERA,
    FALLBACK_ROUTE_COLOR,
    DEPARTURES_CONFIG
} from '../../../config/constants';
import type { StopFeature } from '../../../types/stops';
import type { Departure } from '../../../types/transit';

interface FavoritesStopCardProps {
    stopFeature: StopFeature;
    departures: Departure[];
    isLoading: boolean;
    isError: boolean;
}

export const FavoritesStopCard: React.FC<FavoritesStopCardProps> = ({ 
    stopFeature, 
    departures, 
    isLoading, 
    isError
}) => {
    const { t } = useTranslation();

    // Selection
    const flyTo = useMapMetadataStore(s => s.actions.flyTo);

    // Geolocation
    const userLocation = useGeolocationStore(s => s.userLocation);

    const { toggleFavorite } = usePreferencesStore(s => s.actions);
    const selectedCity = usePreferencesStore(s => s.selectedCity);

    const { stop_id, stop_name, platform_code } = stopFeature.properties;
    const coordinates = stopFeature.geometry.coordinates as [number, number];

    // Distance and Walking Time Calculations
    const stopDistanceInfo = useMemo(
        () => getStopDistanceInfo(userLocation, coordinates),
        [userLocation, coordinates]
    );

    const distanceLabel = stopDistanceInfo ? formatStopDistance(stopDistanceInfo, t) : '';

    // Limit to next 2 upcoming departures
    const next2Departures = useMemo(() => {
        if (!departures || departures.length === 0) return [];
        
        // Ensure they are sorted chronologically
        const sorted = [...departures].sort((a, b) => 
            new Date(a.timestamp || a.scheduled).getTime() - new Date(b.timestamp || b.scheduled).getTime()
        );
        
        return sorted.slice(0, DEPARTURES_CONFIG.FAVORITE_CARD_COUNT);
    }, [departures]);

    // Handle flying to stop and opening its departure board
    const handleCardClick = () => {
        flyTo({
            center: coordinates,
            zoom: MAP_CAMERA.STOP_SELECT_ZOOM,
            duration: MAP_CAMERA.FLY_MS
        });
        
        navigate(paths.stop(selectedCity, stop_id));
    };

    // Toggle favorite unpin
    const handleUnpin = (e: React.MouseEvent) => {
        e.stopPropagation(); // Avoid triggering card click
        toggleFavorite(stop_id);
    };

    return (
        <Card 
            onClick={handleCardClick}
            variant="subtle"
            size="none"
            className={cn(
                "w-full cursor-pointer overflow-hidden transition-colors relative",
                "border border-border/50 dark:border-white/10 ring-0 bg-card dark:bg-[#161616] shadow-sm",
                "hover:border-border dark:hover:border-white/20 focus-visible:outline-none"
            )}
        >
            {/* Header Area */}
            <div className="flex items-center justify-between gap-2 border-b border-border/50 dark:border-white/10 bg-muted/40 dark:bg-white/[0.04] py-1.5 pl-4 pr-2">
                <div className="min-w-0 flex-1">
                    <CardTitle className="flex items-center gap-1.5 text-sm font-semibold leading-tight truncate min-w-0">
                        {platform_code && (
                            <Badge 
                                variant="outline"
                                className="w-5 h-5 p-0 flex items-center justify-center rounded-full shrink-0 border-0 bg-foreground text-background text-[10.5px] font-bold shadow-sm tabular-nums"
                            >
                                {platform_code}
                            </Badge>
                        )}
                        <span className="truncate">{stop_name}</span>
                    </CardTitle>
                    {/* Distance / Walking Time */}
                    {stopDistanceInfo && (
                        <div className={cn(
                            "text-xs font-medium mt-0.5",
                            stopDistanceInfo.isAtStop ? "text-primary font-semibold" : "text-foreground/60"
                        )}>
                            {distanceLabel}
                        </div>
                    )}
                </div>

                {/* Unpin Button */}
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleUnpin}
                    title={t('map.departures.removeFromFavorites')}
                    className="shrink-0 text-amber-500 hover:text-amber-400"
                    aria-label={t('map.departures.removeFromFavorites')}
                >
                    <Star size={16} fill="currentColor" strokeWidth={1.5} />
                </Button>
            </div>

            {/* Departures Area */}
            <CardContent className="p-0">
                {isLoading ? (
                    <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground text-xs">
                        <Loader2 size={14} className="animate-spin text-primary"  strokeWidth={1.5} />
                        <span>{t('common.loading')}</span>
                    </div>
                ) : isError ? (
                    <div className="text-xs text-destructive py-4 text-center">
                        {t('errors.generic')}
                    </div>
                ) : next2Departures.length === 0 ? (
                    <div className="text-xs text-muted-foreground py-4 text-center">
                        {t('map.departures.noUpcoming')}
                    </div>
                ) : (
                    <div className="flex flex-col divide-y divide-black/5 dark:divide-white/5">
                        {next2Departures.map((dep, idx) => {
                            const isTrain = dep.type === 'train';

                            return (
                                <div 
                                    key={dep.tripId ? `${dep.tripId}-${dep.scheduled}` : idx}
                                    className={cn(
                                        "flex items-center gap-3 min-h-11 py-1.5 px-4",
                                        idx % 2 === 1 && "bg-black/[0.015] dark:bg-white/[0.02]"
                                    )}
                                >
                                    <div className="flex flex-col shrink-0 w-10 gap-0.5">
                                        <span className={cn(
                                            "text-muted-foreground text-[13px] font-medium leading-tight tabular-nums",
                                            dep.isCanceled && "line-through opacity-60"
                                        )}>
                                            {format(parseISO(dep.scheduled), 'HH:mm')}
                                        </span>
                                        {!dep.isCanceled && typeof dep.delay === 'number' && dep.delay !== 0 && (
                                            <span className={cn(
                                                "text-[11px] font-bold leading-none tabular-nums",
                                                dep.delay > 0 ? "text-destructive" : "text-sky-500"
                                            )}>
                                                {formatDelay(dep.delay)}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        {/* Line badge */}
                                        <LineBadge
                                            name={String(dep.line)}
                                            routeColor={dep.route_color || FALLBACK_ROUTE_COLOR}
                                        />

                                        {/* Headsign */}
                                        <span className={cn(
                                            "text-foreground text-[13px] font-medium truncate min-w-0 leading-tight",
                                            dep.isCanceled && "line-through text-muted-foreground"
                                        )}>
                                            {dep.headsign}
                                        </span>
                                    </div>

                                    {/* Departure times */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        {/* Platform (Trains only) */}
                                        {dep.platform && isTrain && (
                                            <IconTooltip
                                                label={t('map.departures.platform')}
                                                className="justify-center min-w-6 gap-1 px-1.5 py-0.5 bg-muted rounded-md border text-xs font-semibold text-muted-foreground leading-none tabular-nums"
                                            >
                                                <Train size={12} className="opacity-50" aria-hidden="true" />
                                                <span>{dep.platform}</span>
                                            </IconTooltip>
                                        )}

                                        {dep.isCanceled ? (
                                            <Badge variant="destructive" className="rounded-md font-semibold">
                                                {t('map.departures.canceled')}
                                            </Badge>
                                        ) : (
                                            <span className="text-sm font-bold leading-none text-right min-w-12 tabular-nums">
                                                <Countdown timestamp={dep.timestamp} />
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

FavoritesStopCard.displayName = 'FavoritesStopCard';
