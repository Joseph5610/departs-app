import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Loader2, Train, ArrowRight } from 'lucide-react';
import { useSelection, useViewport, usePreferences } from '../../../state/contexts';
import { calculateDistance } from '../../../utils/transitUtils';
import { formatDelay } from '../../../utils/dateUtils';
import { cn } from '../../../lib/utils';
import { Countdown } from '../DepartureBoard/Countdown';
import { LineBadge } from '../../LineBadge';
import { Badge } from '../../ui/badge';
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
    const { actions: selActions } = useSelection();
    const { mapRef, userLocation } = useViewport();
    const { actions: { toggleFavorite } } = usePreferences();

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
        mapRef.current?.flyTo({
            center: coordinates,
            zoom: MAP_STOP_SELECT_ZOOM,
            duration: MAP_FLY_DURATION
        });
        
        selActions.selectStop(stop_id);
        
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
        <div 
            onClick={handleCardClick}
            className={cn(
                "w-full flex flex-col p-4 rounded-xl text-left transition-all cursor-pointer relative",
                "bg-white/4 border border-white/5 shadow-sm hover:bg-white/8 active:bg-white/12",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
            )}
        >
            {/* Header Area */}
            <div className="flex justify-between items-start gap-2 mb-1">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[15px] font-bold text-foreground leading-tight truncate min-w-0">
                            {stop_name}
                        </span>
                        {platform_code && (
                            <Badge 
                                variant="outline"
                                className="w-5 h-5 rounded-full p-0 flex items-center justify-center bg-white/10 border-white/10 text-foreground text-[10.5px] font-bold tabular-nums shrink-0"
                            >
                                {platform_code}
                            </Badge>
                        )}
                    </div>
                    {/* Distance / Walking Time */}
                    {stopDistanceInfo && (
                        <div className={cn(
                            "text-[11px] font-medium mt-0.5",
                            stopDistanceInfo.isAtStop ? "text-emerald-400 font-semibold" : "text-muted-foreground/60"
                        )}>
                            {distanceLabel}
                        </div>
                    )}
                </div>

                {/* Unpin Button */}
                <button
                    onClick={handleUnpin}
                    title={t('map.departures.removeFromFavorites')}
                    className="p-1.5 -mr-1 rounded-lg hover:bg-rose-500/15 text-muted-foreground opacity-40 hover:opacity-100 hover:text-rose-400 active:bg-rose-500/25 transition-all duration-150 shrink-0 outline-none group"
                    aria-label={t('map.departures.removeFromFavorites')}
                >
                    <Trash2 size={16} strokeWidth={1.5} className="transition-transform duration-150 group-hover:scale-110"  />
                </button>
            </div>

            {/* Departures Area */}
            <div className="mt-3 border-t border-white/5 pt-2">
                {isLoading ? (
                    <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground/40 text-xs">
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
                                    className="flex items-center justify-between gap-3 text-xs py-1"
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
                                                className="flex items-center justify-center shrink-0 min-w-[20px] gap-0.5 px-1 h-[15px] bg-white/5 rounded border border-white/5 shadow-sm text-[8.5px] font-bold text-foreground/50"
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
                                        <span className="text-[12px] font-bold tabular-nums text-foreground/90 text-right min-w-[40px]">
                                            <Countdown timestamp={dep.timestamp} />
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

FavoritesStopCard.displayName = 'FavoritesStopCard';
