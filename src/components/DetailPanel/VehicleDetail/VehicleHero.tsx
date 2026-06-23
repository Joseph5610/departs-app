import React from 'react';
import { useTranslation } from 'react-i18next';
import { Info, MapPin, Snowflake, Accessibility, Zap, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useShare } from '../../../hooks/features/useShare';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import type { VehicleHeroProps } from './types';
import { FALLBACK_ROUTE_COLOR } from '../../../config/constants';
import { getRouteTypeI18nKey } from '../../../utils/transitUtils';

export const VehicleHero: React.FC<VehicleHeroProps> = ({
    displayVehicle,
    isFollowing,
    onToggleFollow,
    liveDataAgeSeconds
}) => {
    const { t } = useTranslation();
    const { share } = useShare();

    if (!displayVehicle) return null;

    const bgColor = displayVehicle.route_color || FALLBACK_ROUTE_COLOR;

    return (
        <Card 
            className="overflow-hidden p-0 gap-0 border border-white/10 backdrop-blur-xl shadow-2xl ring-0 relative flex flex-col transition-colors"
            style={{
                backgroundColor: bgColor ? `color-mix(in srgb, ${bgColor} 12%, rgba(0,0,0,0.4))` : 'rgba(0,0,0,0.4)'
            }}
        >
            <div className="relative z-10 flex flex-col p-4 pb-3">
                <div className="flex flex-row justify-between items-start mb-2">
                        <Button
                        variant="default"
                        className={cn(
                            "flex items-center gap-2 w-fit rounded-lg px-2.5 py-1.5 h-auto text-[15px] font-black text-white transition-all active:scale-95 shadow-sm",
                            isFollowing ? "ring-2 ring-white/50" : "hover:brightness-110 ring-1 ring-white/15"
                        )}
                        style={{ backgroundColor: bgColor }}
                        onClick={onToggleFollow}
                    >
                        <span className="tracking-tight leading-none">{displayVehicle.routeName}</span>
                        <div className={cn(
                            "flex items-center justify-center transition-all",
                            isFollowing ? "text-white" : "text-white/40"
                        )}>
                            <MapPin 
                                size={16} 
                                className="" 
                                strokeWidth={isFollowing ? 2.5 : 2} 
                            />
                        </div>
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-8 w-8 text-muted-foreground"
                        onClick={(e) => {
                            e.stopPropagation();
                            share({
                                title: t('map.vehicleDetails.shareTitle', { line: displayVehicle.routeName }),
                                text: t('map.vehicleDetails.shareText', { line: displayVehicle.routeName }),
                                tripId: displayVehicle.gtfs_trip_id,
                                vehicleId: displayVehicle.vehicle_id || undefined
                            });
                        }}
                    >
                        <Share2 size={16} strokeWidth={1.5} />
                    </Button>
                </div>
                <h2 data-testid="vehicle-headsign" className="text-2xl font-bold tracking-tight leading-tight text-foreground/90">
                    {displayVehicle.trip_headsign || displayVehicle.next_stop_name || t('map.vehicleDetails.headingToDestination')}
                </h2>
            </div>
            
            <div className="relative z-10 flex flex-col gap-3 px-4 pb-4">

                <div className="flex gap-2 flex-wrap items-center">
                    {(() => {
                        const delayVal = Number(displayVehicle.delay || 0);
                        const delayMinutes = Math.round(Math.abs(delayVal) / 60);
                        const isLate = delayVal > 30;
                        const isEarly = delayVal < -30;
                        return (
                            <Badge
                                variant="outline"
                                className={cn(
                                    "h-6 px-2.5 rounded-md text-[9px] font-bold uppercase tracking-wider border-transparent",
                                    isLate ? "bg-rose-500/20 text-rose-500" : isEarly ? "bg-sky-500/20 text-sky-500" : "bg-emerald-500/20 text-emerald-500"
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
                        <Badge variant="muted" className="h-6 px-2.5 rounded-md text-[9px] font-bold uppercase tracking-wider gap-1.5">
                            <div className={cn(
                                "w-1.5 h-1.5 rounded-full shrink-0",
                                liveDataAgeSeconds < 60 ? "bg-primary animate-pulse shadow-[0_0_8px_var(--color-primary)]" : "bg-muted-foreground/40"
                            )} />
                            <span>{t('map.vehicleDetails.liveDataAge', { seconds: liveDataAgeSeconds })}</span>
                        </Badge>
                    )}
                </div>

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
                                <Alert className="mt-2 bg-amber-500/10 text-amber-500 border-amber-500/20">
                                    <Info size={14} className="mt-0.5 text-amber-500 shrink-0" strokeWidth={1.5} />
                                    <AlertTitle className="font-bold text-[10px] uppercase tracking-wider leading-none text-amber-500 mb-1">
                                        {title}
                                    </AlertTitle>
                                    <AlertDescription className="text-amber-500/80 text-[11px] leading-snug font-medium">
                                        {description}
                                    </AlertDescription>
                                </Alert>
                            )}

                        </>
                    );
                })()}
            </div>

            {/* Render Footer outside CardContent if data exists */}
            {displayVehicle.vehicle_descriptor && (
                <div className="relative z-10 flex gap-3 p-3 px-4 bg-muted/20 border-t border-white/5 justify-between items-center mt-auto">
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                        {displayVehicle.vehicle_descriptor?.operator && (
                            <span className="text-muted-foreground/80 text-[9px] uppercase font-bold tracking-wider line-clamp-1">
                                {displayVehicle.vehicle_descriptor.operator}
                            </span>
                        )}
                        <div className="flex items-center gap-1.5 min-w-0 w-full">
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
                            <div className="flex items-center gap-2 mt-0.5 min-w-0 w-full">
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
                        <div className="flex gap-2 shrink-0 bg-black/20 p-2 rounded-lg items-center h-fit">
                            {displayVehicle.vehicle_descriptor?.is_air_conditioned && (
                                <Snowflake size={14} className="text-sky-400" strokeWidth={2} />
                            )}
                            {displayVehicle.vehicle_descriptor?.has_usb_chargers && (
                                <Zap size={14} className="text-amber-400" strokeWidth={2} />
                            )}
                            {displayVehicle.vehicle_descriptor?.is_wheelchair_accessible && (
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

