import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Loader2, Train, ArrowRight } from 'lucide-react';
import { navigate } from 'wouter/use-browser-location';
import { usePreferencesStore } from '../../../state/preferencesStore';
import { useMapMetadataStore } from '../../../state/mapMetadataStore';
import { useGeolocationStore } from '../../../state/geolocationStore';
import { calculateDistance } from '../../../utils/transitUtils';
import { formatDelay } from '../../../utils/dateUtils';
import { cn } from '../../../lib/utils';
import { Countdown } from '../DepartureBoard/Countdown';
import { LineBadge } from '../../LineBadge';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';
import {
    WALKING_SPEED,
    AT_STOP_THRESHOLD_METERS,
    MAX_REASONABLE_WALKING_DISTANCE,
    MAP_STOP_SELECT_ZOOM,
    MAP_FLY_DURATION,
    FALLBACK_ROUTE_COLOR
} from '../../../config/constants';
import type { StopFeature } from '../../../types/stops';
import type { Departure } from '../../../types/transit';

interface FavoritesStopCardProps {
    stopFeature: StopFeature;
    departures: Departure[];
    isLoading: boolean;
    isError: boolean;
    onClosePanel?: () => void;
}

export const FavoritesStopCard: React.FC<FavoritesStopCardProps> = ({ 
    stopFeature, 
    departures, 
    isLoading, 
    isError, 
    onClosePanel 
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
    const stopDistanceInfo = useMemo(() => {
        if (!userLocation || !coordinates) return null;
        const dist = calculateDistance(userLocation, coordinates);
        const isAtStop = dist < AT_STOP_THRESHOLD_METERS;
        const walkingTimeSec = dist / WALKING_SPEED;
        const timeMins = Math.ceil(walkingTimeSec / 60);

        return {
            distance: Math.round(dist),
            time: timeMins,
            isAtStop,
            isReasonable: dist < MAX_REASONABLE_WALKING_DISTANCE
        };
    }, [userLocation, coordinates]);

    // Format distance & walking label
    const distanceLabel = useMemo(() => {
        if (!stopDistanceInfo) return '';
        if (stopDistanceInfo.isAtStop) return t('map.departures.atStop');

        const { distance, time, isReasonable } = stopDistanceInfo;
        if (isReasonable) {
            return t('map.departures.distance', {
                distance,
                count: time
            });
        }

        if (distance >= 1000) {
            return t('map.departures.kilometers', {
                distance: (distance / 1000).toFixed(1)
            });
        }

        return t('map.departures.meters', {
            distance
        });
    }, [stopDistanceInfo, t]);

    // Limit to next 2 upcoming departures
    const next2Departures = useMemo(() => {
        if (!departures || departures.length === 0) return [];
        
        // Ensure they are sorted chronologically
        const sorted = [...departures].sort((a, b) => 
            new Date(a.timestamp || a.scheduled).getTime() - new Date(b.timestamp || b.scheduled).getTime()
        );
        
        return sorted.slice(0, 2);
    }, [departures]);

    // Handle flying to stop and opening its departure board
    const handleCardClick = () => {
        flyTo({
            center: coordinates,
            zoom: MAP_STOP_SELECT_ZOOM,
            duration: MAP_FLY_DURATION
        });
        
        navigate(`/${selectedCity}/stop/${encodeURIComponent(stop_id)}`);
        
        if (onClosePanel) {
            onClosePanel();
        }
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
                "w-full cursor-pointer transition-colors relative group/favcard",
                "bg-card border-border/50 hover:bg-muted/50 active:bg-muted/80 shadow-sm",
                "focus-visible:outline-none"
            )}
        >
            {/* Header Area */}
            <CardHeader className="flex items-center justify-between gap-2 border-b border-border/50 p-3 px-4">
                <div className="min-w-0 flex-1">
                    <CardTitle className="flex items-center gap-1.5 flex-wrap text-[15px] leading-tight truncate min-w-0">
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
                            "text-[11px] font-medium mt-1",
                            stopDistanceInfo.isAtStop ? "text-emerald-400 font-semibold" : "text-muted-foreground/60"
                        )}>
                            {distanceLabel}
                        </div>
                    )}
                </div>

                {/* Unpin Button */}
                <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleUnpin}
                    title={t('map.departures.removeFromFavorites')}
                    className="hover:bg-rose-500/15 text-muted-foreground opacity-40 hover:opacity-100 hover:text-rose-400 active:bg-rose-500/25 transition-[colors,opacity,transform] duration-150 shrink-0 group"
                    aria-label={t('map.departures.removeFromFavorites')}
                >
                    <Trash2 size={16} strokeWidth={1.5} className="transition-transform duration-150 group-hover:scale-110" />
                </Button>
            </CardHeader>

            {/* Departures Area */}
            <CardContent className="p-3 px-4">
                {isLoading ? (
                    <div className="flex items-center justify-center py-2 gap-2 text-muted-foreground/40 text-xs">
                        <Loader2 size={14} className="animate-spin text-primary"  strokeWidth={1.5} />
                        <span>{t('common.loading')}</span>
                    </div>
                ) : isError ? (
                    <div className="text-[11.5px] text-destructive/80 py-2 text-center">
                        {t('errors.generic')}
                    </div>
                ) : next2Departures.length === 0 ? (
                    <div className="text-[11.5px] text-muted-foreground/40 py-2 text-center">
                        {t('map.departures.noUpcoming')}
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {next2Departures.map((dep, idx) => {
                            const isTrain = dep.type === '2' || dep.type === 'train';

                            return (
                                <div 
                                    key={dep.tripId ? `${dep.tripId}-${dep.scheduled}` : idx}
                                    className="flex items-center justify-between gap-3 text-xs py-0.5"
                                >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        {/* Line badge */}
                                        <div className="shrink-0 flex items-center">
                                            <LineBadge 
                                                name={String(dep.line)} 
                                                routeColor={dep.route_color || FALLBACK_ROUTE_COLOR} 
                                            />
                                        </div>

                                        <ArrowRight size={12} className="text-muted-foreground/30 shrink-0"  strokeWidth={1.5} />

                                        {/* Headsign */}
                                        <span className="text-foreground/80 font-medium truncate min-w-0 leading-tight">
                                            {dep.headsign}
                                        </span>
                                    </div>

                                    {/* Departure times */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        {/* Platform (Trains only) */}
                                        {dep.platform && isTrain && (
                                            <div 
                                                className="flex items-center justify-center shrink-0 min-w-5 gap-0.5 px-1 h-3.75 bg-muted/50 rounded border border-border/50 shadow-sm text-[8.5px] font-bold text-foreground/50 tabular-nums"
                                            >
                                                <Train size={12} strokeWidth={1.5} className="opacity-30"  />
                                                <span>{dep.platform}</span>
                                            </div>
                                        )}

                                        {/* Delay */}
                                        {typeof dep.delay === 'number' && dep.delay !== 0 && (
                                            <span className={cn(
                                                "text-[9px] font-bold tabular-nums",
                                                dep.delay > 0 ? "text-rose-400" : "text-sky-400"
                                            )}>
                                                {formatDelay(dep.delay)}
                                            </span>
                                        )}

                                        {/* Countdown */}
                                        <span className="text-xs font-bold text-foreground/90 text-right min-w-10 tabular-nums">
                                            <Countdown timestamp={dep.timestamp} />
                                        </span>
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
