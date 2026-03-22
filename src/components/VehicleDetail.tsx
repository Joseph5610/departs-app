
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Info, MapPin, Snowflake, Accessibility, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getVehicleColor } from '../utils/vehicleColors';
import { useRSS } from '../hooks/useRSS';
import { parseISO } from 'date-fns';
import { GenericAlertCard } from './GenericAlertCard';
import { Box, Stack, HStack, Surface } from '@/components/ui/layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { VehicleDetailSkeleton } from './LoadingSkeletons';

import type { VehicleDetail as VehicleDetailType } from '../types/transit';

interface VehicleDetailProps {
    selectedVehicle: VehicleDetailType | null;
    vehicleDetail: VehicleDetailType | null;
    loadingDetail: boolean;
    isFollowing: boolean;
    onToggleFollow: () => void;
}

/**
 * VehicleDetail
 *
 * Re-architected with semantic layout components.
 * Highly robust update: ensures type safety for routeName and sequence numbers.
 * Handled edge cases for MapLibre data delivery.
 */
export const VehicleDetail = React.memo<VehicleDetailProps>(({
    selectedVehicle,
    vehicleDetail,
    loadingDetail,
    isFollowing,
    onToggleFollow
}) => {
    const { t } = useTranslation();
    const { data: rssData } = useRSS();
    const [showPastStops, setShowPastStops] = useState(false);
    const [liveDataAgeSeconds, setLiveDataAgeSeconds] = useState<number | null>(null);

    const displayVehicle = useMemo(() => {
        if (!selectedVehicle) return null;
        const merged = { ...selectedVehicle, ...vehicleDetail };
        const routeName = String(merged.route_short_name || '');
        const isStaticFallback = !!merged.is_static_fallback;

        // Effective sequence: suppress highlight if static fallback
        const rawSeq = merged.last_stop_sequence;
        const effectiveSequence = (isStaticFallback || rawSeq === null || rawSeq === undefined) ? null : Number(rawSeq);

        return {
            ...merged,
            routeName,
            isStaticFallback,
            effectiveSequence,
            routeType: Number(merged.route_type || 0)
        };
    }, [selectedVehicle, vehicleDetail]);

    React.useEffect(() => {
        const originTs = displayVehicle?.origin_timestamp;
        if (!originTs) {
            setLiveDataAgeSeconds(null);
            return;
        }

        const updateAge = () => {
            try {
                const tsString = String(originTs);
                const timestamp = parseISO(tsString);
                const now = new Date();
                const ageInSeconds = Math.floor((now.getTime() - timestamp.getTime()) / 1000);
                setLiveDataAgeSeconds(ageInSeconds);
            } catch {
                setLiveDataAgeSeconds(null);
            }
        };

        updateAge();
        const interval = setInterval(updateAge, 1000);
        return () => clearInterval(interval);
    }, [displayVehicle?.origin_timestamp]);

    const relevantAlerts = useMemo(() => {
        const allItems = rssData?.alerts || [];
        const routeName = displayVehicle?.routeName;
        if (!routeName) return [];
        const upperRouteName = routeName.toUpperCase();
        return allItems.filter(item =>
            item.lines?.some((l: string) => String(l).toUpperCase() === upperRouteName) &&
            item.isActive
        );
    }, [rssData, displayVehicle?.routeName]);

    const nextStopSequence = useMemo(() => {
        if (!displayVehicle?.stop_times?.features || displayVehicle.effectiveSequence === null) return null;
        const futureStops = displayVehicle.stop_times.features
            .filter((s) => Number(s.properties.stop_sequence) > (displayVehicle.effectiveSequence ?? 0))
            .sort((a, b) => Number(a.properties.stop_sequence) - Number(b.properties.stop_sequence));
        return futureStops.length > 0 ? Number(futureStops[0].properties.stop_sequence) : null;
    }, [displayVehicle]);

    if (!displayVehicle) return null;

    return (
        <Stack gap={4}>
            {/* Loading State */}
            {loadingDetail && !vehicleDetail && (
                <VehicleDetailSkeleton />
            )}

            {/* Header Hero Section */}
            <Surface variant="tinted" padding="none" className="relative overflow-hidden border-white/15! rounded-2xl bg-slate-950/20 backdrop-blur-2xl">
                <Box
                    className="absolute inset-0 opacity-5"
                    style={{ backgroundColor: getVehicleColor(displayVehicle.routeType, displayVehicle.routeName) }}
                />
                <Stack gap={1} className="relative z-10 px-6 py-6">
                    <button
                        className="h-7 px-2.5 w-fit rounded-lg flex items-center justify-center shadow-lg relative group transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-ring ring-1 ring-white/10"
                        style={{ backgroundColor: getVehicleColor(displayVehicle.routeType, displayVehicle.routeName) }}
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

                    <h3 className="text-3xl font-bold text-foreground leading-[1.1] tracking-tight py-1.5">
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
                                        <span className="text-muted-foreground/60 text-[8px] uppercase font-bold tracking-[0.15em] truncate block w-full mb-0.5">
                                            {displayVehicle.vehicle_descriptor?.operator}
                                        </span>
                                        <HStack gap={2} align="center" className="min-w-0 w-full">
                                            <span className="text-foreground text-[10px] font-bold truncate shrink leading-none">
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

            {/* Alerts */}
            {relevantAlerts.length > 0 && (
                <Stack gap={2}>
                    {relevantAlerts.map((alert, idx) => (
                        <GenericAlertCard
                            key={alert.guid || idx}
                            title={alert.title}
                            description={alert.description}
                            link={alert.link}
                            priority={alert.priority || 'normal'}
                            validFrom={alert.valid_from}
                            validTo={alert.valid_to}
                            isActive={alert.isActive}
                            isFuture={alert.isFuture}
                        />
                    ))}
                </Stack>
            )}

            {/* Schedule / Stop List */}
            {displayVehicle.stop_times?.features && displayVehicle.stop_times.features.length > 0 && (
                <Collapsible open={showPastStops} onOpenChange={setShowPastStops}>
                    <Stack gap={3}>
                        <HStack justify="between" className="px-1">
                            <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest">{t('map.vehicleDetails.routeSchedule')}</span>
                            {displayVehicle.effectiveSequence !== null && (
                                <CollapsibleTrigger render={
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 rounded-xl text-[10px] bg-transparent hover:bg-muted/50 text-muted-foreground hover:text-foreground font-bold uppercase tracking-wider px-2 gap-1.5"
                                    />
                                }>
                                    {showPastStops ? t('map.vehicleDetails.hidePastStops') : t('map.vehicleDetails.showPastStops')}
                                    {showPastStops ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </CollapsibleTrigger>
                            )}
                        </HStack>
                        <Box className="relative pl-6 overflow-hidden!">
                            <Box className="absolute left-[11px] top-3 bottom-6 w-0.5 bg-border" />

                            {/* Past Stops (Collapsible) */}
                            <CollapsibleContent className="transition-[height] duration-300 ease-in-out data-[state=closed]:overflow-hidden data-[state=open]:overflow-visible">
                                {displayVehicle.stop_times.features
                                    .filter(stop => Number(stop.properties.stop_sequence) < (displayVehicle.effectiveSequence ?? 0))
                                    .map((stop, idx: number) => (
                                        <StopItem
                                            key={`past-${idx}`}
                                            stop={stop}
                                            isPast={true}
                                            effectiveSequence={displayVehicle.effectiveSequence}
                                            nextStopSequence={nextStopSequence}
                                        />
                                    ))
                                }
                            </CollapsibleContent>

                            {/* Current & Future Stops */}
                            {displayVehicle.stop_times.features
                                .filter(stop => Number(stop.properties.stop_sequence) >= (displayVehicle.effectiveSequence ?? 0))
                                .map((stop, idx: number) => (
                                    <StopItem
                                        key={`future-${idx}`}
                                        stop={stop}
                                        isPast={false}
                                        effectiveSequence={displayVehicle.effectiveSequence}
                                        nextStopSequence={nextStopSequence}
                                    />
                                ))
                            }
                        </Box>
                    </Stack>
                </Collapsible>
            )}
        </Stack>
    );
});

const StopItem = ({ stop, isPast, effectiveSequence, nextStopSequence }: {
    stop: Required<Required<VehicleDetailType>['stop_times']>['features'][number],
    isPast: boolean,
    effectiveSequence: number | null,
    nextStopSequence: number | null
}) => {
    const { t } = useTranslation();
    const stopSeq = Number(stop.properties.stop_sequence);
    const isCurrent = stopSeq === effectiveSequence;
    const isNext = stopSeq === nextStopSequence;
    const showZone = !!stop.properties.zone_id;

    return (
        <HStack justify="between" className={cn(
            "relative py-2.5 transition-opacity",
            isPast ? "opacity-40" : "opacity-100"
        )}>
            <Box className={cn(
                "absolute -left-[17px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full z-10 shadow-md",
                isCurrent ? "bg-primary ring-[5px] ring-primary/20" : isPast ? "bg-foreground/20" : "bg-foreground/50"
            )} />
            <Stack align="start" gap={0} className="min-w-0 pr-2 flex-1">
                <span className={cn(
                    "text-sm truncate w-full",
                    isCurrent ? "text-primary font-bold" : isNext ? "text-foreground font-bold" : isPast ? "text-muted-foreground" : "text-foreground font-medium"
                )}>
                    {stop.properties.stop_name}
                </span>
                <HStack gap={2} align="center" className="flex-wrap">
                    {isCurrent && <span className="text-[10px] text-primary font-bold uppercase tracking-wider">{t('map.vehicleDetails.currentStop')}</span>}
                    {isNext && <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{t('map.vehicleDetails.nextStop')}</span>}
                </HStack>
            </Stack>
            <Box className="shrink-0 w-8 flex justify-center">
                {showZone && (
                    <span className="text-[10px] text-muted-foreground/60 font-bold bg-muted/30 px-1.5 py-0.5 rounded-md border border-border/50 tabular-nums">
                        {stop.properties.zone_id}
                    </span>
                )}
            </Box>
            <Stack align="end" gap={0} className="shrink-0 min-w-[64px]">
                {(() => {
                    const { realtime_arrival_time, arrival_time } = stop.properties;
                    const realtimeTime = realtime_arrival_time || arrival_time;
                    const scheduledTime = arrival_time;
                    const hasRealtime = !!realtime_arrival_time && realtime_arrival_time !== arrival_time;
                    const isEarly = hasRealtime && realtime_arrival_time < arrival_time;
                    const isLate = hasRealtime && realtime_arrival_time > arrival_time;
                    return (
                        <>
                            <span className={cn(
                                "text-xs tabular-nums",
                                isPast ? "text-muted-foreground" : isEarly ? "text-primary" : isLate ? "text-destructive" : "text-muted-foreground"
                            )}>
                                {String(realtimeTime || '').slice(0, 8)}
                            </span>
                            {hasRealtime && (
                                <span className="text-[9px] text-muted-foreground tabular-nums">
                                    {t('map.vehicleDetails.scheduledTime')} {String(scheduledTime || '').slice(0, 8)}
                                </span>
                            )}
                        </>
                    );
                })()}
            </Stack>
        </HStack>
    );
};

VehicleDetail.displayName = 'VehicleDetail';
