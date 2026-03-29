import React from 'react';
import { useTranslation } from 'react-i18next';
import { Info, MapPin, Snowflake, Accessibility, Zap, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useShare } from '../../../hooks/features/useShare';
import { Box, Stack, HStack, Surface } from '@/components/ui/layout';
import { Badge } from '@/components/ui/badge';
import type { VehicleHeroProps } from './types';

export const VehicleHero: React.FC<VehicleHeroProps> = ({
    displayVehicle,
    isFollowing,
    onToggleFollow,
    liveDataAgeSeconds
}) => {
    const { t } = useTranslation();
    const { share } = useShare();

    if (!displayVehicle) return null;

    return (
        <Surface variant="tinted" padding="none" className="overflow-hidden rounded-2xl">
            <Box
                className="absolute inset-0 opacity-5"
                style={{ backgroundColor: displayVehicle.line_color }}
            />
            <Stack gap={1} className="relative z-10 px-6 py-6">
                <HStack justify="between" align="center" className="w-full">
                    <button
                        className="h-7 px-2.5 w-fit rounded-lg flex items-center justify-center shadow-lg relative group transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-ring ring-1 ring-white/10"
                        style={{ backgroundColor: displayVehicle.line_color }}
                        onClick={onToggleFollow}
                    >
                        <span className="text-sm font-black text-white leading-none tracking-tight pr-1.5">{displayVehicle.routeName}</span>
                        <Box className={cn(
                            "w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors border-[1.5px] border-white/30 bg-white shadow-inner",
                            isFollowing ? "text-primary" : "text-slate-300"
                        )}>
                            <MapPin size={8} className={cn(isFollowing ? "fill-current" : "")} />
                        </Box>
                    </button>
                    
                    <button
                        className="bg-white/10 hover:bg-white/20 border border-white/15 rounded-lg w-7 h-7 backdrop-blur-md transition-colors flex items-center justify-center text-white/90 active:scale-90"
                        onClick={(e) => {
                            e.stopPropagation();
                            share({
                                title: t('map.vehicleDetails.shareTitle', { line: displayVehicle.routeName }),
                                text: t('map.vehicleDetails.shareText', { line: displayVehicle.routeName }),
                                url: window.location.href
                            });
                        }}
                    >
                        <Share2 size={13} />
                    </button>
                </HStack>

                <h3 className="text-3xl font-bold text-foreground leading-[1.1] tracking-tight py-1.5 line-clamp-3">
                    {displayVehicle.trip_headsign || displayVehicle.next_stop_name || t('map.vehicleDetails.headingToDestination')}
                </h3>

                <HStack gap={2} className="flex-wrap">
                    {(() => {
                        const delayVal = Number(displayVehicle.delay || 0);
                        const delayMinutes = Math.round(Math.abs(delayVal) / 60);
                        const isLate = delayVal > 30;
                        const isEarly = delayVal < -30;
                        return (
                            <Badge
                                variant={isLate ? 'danger' : isEarly ? 'info' : 'success'}
                                className="h-6 px-2.5 text-[9px] font-bold uppercase tracking-wider rounded-md border-white/5"
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
                        <Box className="flex items-center gap-1.5 px-2.5 h-6 rounded-md bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80">
                            <Box className={cn(
                                "w-1 h-1 rounded-full",
                                liveDataAgeSeconds < 60 ? "bg-primary animate-pulse shadow-[0_0_8px_var(--color-primary)]" : "bg-muted-foreground/40"
                            )} />
                            <span>{t('map.vehicleDetails.liveDataAge', { seconds: liveDataAgeSeconds })}</span>
                        </Box>
                    )}
                </HStack>

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
                                <HStack gap={3} className="mt-4 items-start">
                                    <Box className="p-2 bg-amber-500/10 rounded-lg text-amber-500 shrink-0">
                                        <Info size={14} />
                                    </Box>
                                    <Stack gap={1}>
                                        <span className="text-amber-500 font-bold text-[10px] uppercase tracking-wider leading-none">{title}</span>
                                        <p className="text-amber-500/80 text-[11px] leading-snug font-medium">
                                            {description}
                                        </p>
                                    </Stack>
                                </HStack>
                            )}

                            <HStack gap={2} className="mt-4 pt-4 border-t border-white/5 flex-wrap justify-between items-end">
                                <Stack gap={0} className="min-w-0 flex-1">
                                    <span className="text-muted-foreground/60 text-[8px] uppercase font-bold tracking-[0.15em] line-clamp-1 block w-full mb-0.5">
                                        {displayVehicle.vehicle_descriptor?.operator}
                                    </span>
                                    <HStack gap={2} align="center" className="min-w-0 w-full">
                                        <span className="text-foreground text-[10px] font-bold line-clamp-1 shrink leading-none">
                                            {displayVehicle.vehicle_descriptor?.vehicle_type || '---'}
                                        </span>
                                        <span className="text-muted-foreground/80 text-[10px] font-bold shrink-0 leading-none">
                                            #{displayVehicle.vehicle_descriptor?.vehicle_registration_number}
                                        </span>
                                        {displayVehicle.run_number && (
                                            <span className="text-muted-foreground/60 text-[9px] font-bold ml-1 pl-2 border-l border-white/10 leading-none">
                                                {t('map.vehicleDetails.runNumber')} {displayVehicle.run_number}
                                            </span>
                                        )}
                                    </HStack>
                                </Stack>

                                <HStack gap={3} className="shrink-0 pb-0.5">
                                    {displayVehicle.vehicle_descriptor?.is_air_conditioned && (
                                        <Snowflake size={13} className="text-sky-400" />
                                    )}
                                    {displayVehicle.vehicle_descriptor?.has_usb_chargers && (
                                        <Zap size={13} className="text-amber-400" />
                                    )}
                                    {displayVehicle.vehicle_descriptor?.is_wheelchair_accessible && (
                                        <Accessibility size={13} className="text-primary" />
                                    )}
                                </HStack>
                            </HStack>
                        </>
                    );
                })()}
            </Stack>
        </Surface>
    );
};

VehicleHero.displayName = 'VehicleHero';

