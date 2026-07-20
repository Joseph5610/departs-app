import React from 'react';
import { useTranslation } from 'react-i18next';
import { Info, MapPin, MapPinOff, Snowflake, Accessibility, Zap, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useShare } from '../../../hooks/features/useShare';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { VehicleHeroProps } from './types';
import { FALLBACK_ROUTE_COLOR } from '../../../config/constants';
import { getRouteTypeI18nKey } from '../../../utils/transitUtils';
import { LineBadge } from '../../LineBadge';

export const VehicleHero: React.FC<VehicleHeroProps> = ({
    displayVehicle,
    isFollowing,
    onToggleFollow,
    liveDataAgeSeconds,
    isDetailLoading,
    hasEnrichment
}) => {
    const { t } = useTranslation();
    const { share } = useShare();

    if (!displayVehicle) return null;

    const isEnriched = !!displayVehicle.is_enriched;

    const bgColor = displayVehicle.route_color || FALLBACK_ROUTE_COLOR;

    return (
        <Card 
            className="p-0 gap-0 border border-border/50 ring-0 shadow-xl relative flex flex-col transition-colors"
            style={{
                backgroundColor: bgColor ? `color-mix(in srgb, ${bgColor} 12%, var(--hero-base))` : 'var(--card)'
            }}
        >
            <div className="relative z-10 flex flex-col p-4 pb-3">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center">
                        <LineBadge 
                            name={displayVehicle.routeName} 
                            routeColor={bgColor} 
                            size="xl" 
                            className="shadow-sm border-white/10" 
                        />
                    </div>

                    <div className="flex gap-2">
                        {isDetailLoading && (
                            <Skeleton className="w-8 h-8 rounded-full bg-neutral-800/50" />
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onToggleFollow}
                            className={cn(
                                "rounded-full w-8 h-8 shrink-0 transition-colors",
                                isFollowing 
                                    ? "text-white bg-white/20 hover:bg-white/30" 
                                    : "text-neutral-400 hover:text-white hover:bg-white/10"
                            )}
                            aria-label={t('map.vehicleDetail.track')}
                        >
                            {isFollowing ? (
                                <MapPin size={16} strokeWidth={2.5} />
                            ) : (
                                <MapPinOff size={16} strokeWidth={2} />
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full w-8 h-8 shrink-0 text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                share({
                                    title: t('map.vehicleDetails.shareTitle', { line: displayVehicle.routeName }),
                                    text: t('map.vehicleDetails.shareText', { line: displayVehicle.routeName }),
                                    tripId: displayVehicle.gtfs_trip_id,
                                    vehicleId: displayVehicle.vehicle_id || undefined
                                });
                            }}
                            aria-label={t('map.vehicleDetail.share')}
                        >
                            <Share2 size={16} strokeWidth={1.5} />
                        </Button>
                    </div>
                </div>
                <h2 data-testid="vehicle-headsign" className="text-2xl font-bold tracking-tight leading-tight text-foreground/90">
                    {displayVehicle.trip_headsign || displayVehicle.next_stop_name ? (
                        <span className="animate-in fade-in duration-500">
                            {displayVehicle.trip_headsign || displayVehicle.next_stop_name}
                        </span>
                    ) : isDetailLoading ? (
                        <Skeleton className="h-7 w-3/4 max-w-[320px] rounded-md bg-muted opacity-40" />
                    ) : (
                        t('map.vehicleDetails.headingToDestination')
                    )}
                </h2>
            </div>
            
            <div className="relative z-10 flex flex-col gap-3 px-4 pb-4">

                {!displayVehicle.isStaticFallback && (
                    <div className="flex gap-2 flex-wrap items-center">
                        {(() => {
                            if (displayVehicle.delay === null) {
                                return (
                                    <Badge
                                        variant="outline"
                                        className="h-6 px-2.5 rounded-md text-[9px] font-bold uppercase tracking-wider border-transparent bg-muted/40 text-muted-foreground"
                                    >
                                        {t('map.vehicleDetails.unknownDelay')}
                                    </Badge>
                                );
                            }

                            const delayVal = Number(displayVehicle.delay || 0);
                            const delayMinutes = Math.round(Math.abs(delayVal) / 60);
                            const isLate = delayVal > 30;
                            const isEarly = delayVal < -30;
                            return (
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "h-6 px-2.5 rounded-md text-[9px] font-bold uppercase tracking-wider border-transparent bg-card shadow-sm",
                                        isLate ? "text-rose-500" : isEarly ? "text-sky-500" : "text-emerald-500"
                                    )}
                                >
                                    {isLate
                                        ? t('map.vehicleDetails.delayLabel', { minutes: delayMinutes || 1 })
                                        : isEarly
                                            ? t('map.vehicleDetails.earlyLabel', { minutes: delayMinutes || 1 })
                                            : t('map.vehicleDetails.onTime')}
                                </Badge>
                            );
                        })()}

                        {displayVehicle.origin_timestamp && liveDataAgeSeconds !== null && (
                            <Popover>
                                <PopoverTrigger render={<button type="button" className="outline-none" />}>
                                    <Badge variant="muted" className={cn(
                                        "h-6 px-2.5 rounded-md text-[9px] font-bold uppercase tracking-wider gap-1.5 cursor-pointer bg-card shadow-sm hover:brightness-95 transition-colors border-transparent",
                                        isEnriched ? "text-emerald-500" : 
                                        (hasEnrichment && !isEnriched) ? "text-amber-500" : "text-muted-foreground"
                                    )}>
                                        <div className={cn(
                                            "w-1.5 h-1.5 rounded-full shrink-0",
                                            isEnriched ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_var(--color-emerald-500)]" :
                                            (hasEnrichment && !isEnriched) ? "bg-amber-500 animate-pulse shadow-[0_0_8px_var(--color-amber-500)]" :
                                            liveDataAgeSeconds < 60 ? "bg-primary animate-pulse shadow-[0_0_8px_var(--color-primary)]" : "bg-muted-foreground/40"
                                        )} />
                                        <span>{t('map.vehicleDetails.liveDataAge', { seconds: liveDataAgeSeconds })}</span>
                                    </Badge>
                                </PopoverTrigger>
                                <PopoverContent side="bottom" align="center" className="w-auto border bg-popover/70 backdrop-blur-xl shadow-2xl p-3 max-w-[250px]">
                                    <span className="text-[13px] font-medium text-foreground/90 leading-tight block">
                                        {isEnriched 
                                            ? t('map.vehicleDetails.enrichedTooltip') 
                                            : hasEnrichment 
                                                ? t('map.vehicleDetails.connectingTooltip')
                                                : t('map.vehicleDetails.standardTooltip')
                                        }
                                    </span>
                                </PopoverContent>
                            </Popover>
                        )}
                    </div>
                )}

                {/* Warning Banner & Metadata Footer */}
                {(() => {
                    const state = displayVehicle.state_position;
                    const isBeforeTrack = ['before_track', 'before_track_delayed'].includes(state || '');
                    const isOffTrack = state === 'off_track';
                    const isShowBanner = isBeforeTrack || isOffTrack || displayVehicle.isStaticFallback;

                    const title = displayVehicle.isStaticFallback
                        ? t('map.vehicleDetails.staticFallback')
                        : isBeforeTrack
                            ? t('map.vehicleDetails.previousTrip')
                            : t('map.vehicleDetails.offTrack');

                    const description = displayVehicle.isStaticFallback
                        ? t('map.vehicleDetails.staticFallbackDescription')
                        : isBeforeTrack
                            ? t('map.vehicleDetails.previousTripDescription')
                            : t('map.vehicleDetails.offTrackDescription');

                    return (
                        <>
                            {isShowBanner && (
                                <div className="mt-1 flex items-start gap-2.5">
                                    <Info size={16} className="mt-0.5 text-amber-500 shrink-0" strokeWidth={2} />
                                    <div className="flex flex-col gap-1">
                                        <span className="font-bold text-[10px] uppercase tracking-wider leading-none text-amber-500">
                                            {title}
                                        </span>
                                        <span className="text-amber-500/80 text-[11px] leading-snug font-medium">
                                            {description}
                                        </span>
                                    </div>
                                </div>
                            )}

                        </>
                    );
                })()}
            </div>

            {/* Render Footer outside CardContent if data exists */}
            {displayVehicle.vehicle_descriptor && (
                <div className="relative z-10 flex gap-3 p-3 px-4 bg-muted/20 border-t border-border/50 justify-between items-center mt-auto">
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                        {displayVehicle.vehicle_descriptor?.operator && (
                            <span className="text-muted-foreground/80 text-[9px] uppercase font-bold tracking-wider line-clamp-1">
                                {displayVehicle.vehicle_descriptor.operator}
                            </span>
                        )}
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-semibold truncate text-foreground/90">
                                {displayVehicle.vehicle_descriptor?.vehicle_type || (() => {
                                    const typeKey = getRouteTypeI18nKey(displayVehicle.route_type);
                                    return typeKey ? t(typeKey) : '---';
                                })()}
                            </span>
                            <span className="text-muted-foreground text-xs font-medium shrink-0">
                                #{displayVehicle.vehicle_descriptor?.vehicle_registration_number}
                            </span>
                        </div>
                        {(displayVehicle.run_number || (displayVehicle.vehicle_id && displayVehicle.vehicle_id !== String(displayVehicle.vehicle_descriptor?.vehicle_registration_number))) && (
                            <div className="flex items-center gap-2 mt-0.5 min-w-0">
                                {displayVehicle.run_number && (
                                    <span className="text-muted-foreground text-[10px] uppercase tracking-wider font-bold shrink-0">
                                        {t('map.vehicleDetails.runNumber')} {displayVehicle.run_number}
                                    </span>
                                )}
                                {displayVehicle.vehicle_id && displayVehicle.vehicle_id !== String(displayVehicle.vehicle_descriptor?.vehicle_registration_number) && (
                                    <span className="text-muted-foreground/50 text-[9px] font-mono uppercase tracking-widest truncate">
                                        {displayVehicle.vehicle_id}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {(displayVehicle.vehicle_descriptor?.is_air_conditioned || 
                      displayVehicle.vehicle_descriptor?.has_usb_chargers || 
                      displayVehicle.vehicle_descriptor?.is_wheelchair_accessible) && (
                        <div className="flex gap-2 shrink-0 bg-muted/50 p-2 rounded-lg items-center h-fit">
                            {displayVehicle.vehicle_descriptor?.is_air_conditioned && (
                                <Snowflake size={14} className="text-sky-400" strokeWidth={2} />
                            )}
                            {displayVehicle.vehicle_descriptor?.has_usb_chargers && (
                                <Zap size={14} className="text-amber-400" strokeWidth={2} />
                            )}
                            {(displayVehicle.vehicle_descriptor?.is_wheelchair_accessible) && (
                                <Accessibility size={14} className="text-emerald-400" strokeWidth={2} />
                            )}
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
};

VehicleHero.displayName = 'VehicleHero';

