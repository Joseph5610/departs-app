
import React, { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Info, MapPin, Snowflake, Accessibility, Zap, Navigation, ChevronDown, ChevronUp } from 'lucide-react';
import { StatusPill } from './StatusPill';
import { cn } from '@/lib/utils';
import { getVehicleColor } from '../utils/vehicleColors';
import { useRSS } from '../hooks/useRSS';
import { parseISO } from 'date-fns';
import { GenericAlertCard } from './GenericAlertCard';
import { Box, Stack, HStack, Surface } from '@/components/ui/layout';
import { Button } from '@/components/ui/button';
import { VehicleDetailSkeleton } from './LoadingSkeletons';

import type { TrackedVehicle, VehicleDetail as VehicleDetailType } from '../types/transit';

interface VehicleDetailProps {
    selectedVehicle: TrackedVehicle | null;
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

    const originTs = vehicleDetail?.origin_timestamp || selectedVehicle?.origin_timestamp;

    React.useEffect(() => {
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
    }, [originTs]);

    // Safety: Ensure routeName is always a string and not "undefined"
    const rawRouteName = selectedVehicle?.route_short_name || vehicleDetail?.route_short_name;
    const routeName = (rawRouteName !== undefined && rawRouteName !== null) ? String(rawRouteName) : '';

    const relevantAlerts = useMemo(() => {
        const allItems = rssData?.alerts || [];
        if (!routeName) return [];
        const upperRouteName = routeName.toUpperCase();
        return allItems.filter(item =>
            item.lines?.some((l: string) => String(l).toUpperCase() === upperRouteName) &&
            item.isActive
        );
    }, [rssData, routeName]);

    // Safety: Coerce sequence to number, handle strings from MapLibre
    const effectiveSequence = useMemo(() => {
        const seq = selectedVehicle?.last_stop_sequence ?? vehicleDetail?.last_stop_sequence ?? null;
        return (seq !== null && seq !== undefined) ? Number(seq) : null;
    }, [selectedVehicle?.last_stop_sequence, vehicleDetail?.last_stop_sequence]);

    const nextStopSequence = useMemo(() => {
        if (!vehicleDetail?.stop_times?.features || effectiveSequence === null) return null;
        const futureStops = vehicleDetail.stop_times.features
            .filter((s) => Number(s.properties.stop_sequence) > effectiveSequence)
            .sort((a, b) => Number(a.properties.stop_sequence) - Number(b.properties.stop_sequence));
        return futureStops.length > 0 ? Number(futureStops[0].properties.stop_sequence) : null;
    }, [vehicleDetail, effectiveSequence]);

    const filteredStops = useMemo(() => {
        if (!vehicleDetail?.stop_times?.features) return [];
        const limit = effectiveSequence ?? 0;
        return vehicleDetail.stop_times.features.filter((stop) =>
            showPastStops || Number(stop.properties.stop_sequence) >= limit
        );
    }, [vehicleDetail, showPastStops, effectiveSequence]);

    const handleTogglePastStops = useCallback(() => {
        setShowPastStops(prev => !prev);
    }, []);

    if (!selectedVehicle) return null;

    const routeType = selectedVehicle.route_type ?? 0;

    return (
        <Stack gap={4}>
            {/* Loading State */}
            {loadingDetail && !vehicleDetail && (
                <VehicleDetailSkeleton />
            )}

            {/* Warning: Before Track / Previous Trip */}
            {((['before_track', 'before_track_delayed'] as string[]).includes(String(selectedVehicle.state_position || '')) || (['before_track', 'before_track_delayed'] as string[]).includes(String(vehicleDetail?.state_position || ''))) && (
                <Surface variant="tinted" padding="md" className="bg-amber-500/10 border-amber-500/20! flex flex-row items-start gap-4">
                    <Box className="p-2 bg-amber-500/20 rounded-full text-amber-500 shrink-0">
                        <Info size={20} />
                    </Box>
                    <Stack gap={1}>
                        <h4 className="text-amber-500 font-bold text-sm">{t('map.vehicleDetails.previousTrip')}</h4>
                        <p className="text-amber-500/80 text-xs leading-relaxed">
                            {t('map.vehicleDetails.previousTripDescription')}
                        </p>
                    </Stack>
                </Surface>
            )}

            {/* Header Hero Section */}
            <Surface variant="tinted" padding="md" className="relative overflow-hidden md:p-6 border-white/10!">
                <Box
                    className="absolute inset-0 opacity-10"
                    style={{ backgroundColor: getVehicleColor(routeType, routeName) }}
                />
                <HStack align="center" gap={4} className="relative z-10 flex-col text-center">
                    <button
                        className="w-14 h-14 md:w-16 md:h-16 shrink-0 rounded-2xl flex flex-col items-center justify-center shadow-2xl relative group transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        style={{ backgroundColor: getVehicleColor(routeType, routeName) }}
                        onClick={onToggleFollow}
                    >
                        <span className="text-2xl md:text-3xl font-black text-white leading-none">{routeName}</span>
                                <Box className={cn(
                                    "absolute -bottom-1 -right-1 w-5 h-5 md:w-6 md:h-6 rounded-full border-2 border-background flex items-center justify-center transition-colors",
                                    isFollowing ? "bg-primary" : "bg-muted"
                                )}>
                                    <MapPin size={isFollowing ? 10 : 12} className="text-white" />
                                </Box>
                            </button>
                            <Stack align="center" gap={1} className="flex-1 min-w-0 w-full">
                                <h3 className="text-lg md:text-xl font-bold text-foreground truncate w-full text-center">
                                    {vehicleDetail?.trip_headsign || selectedVehicle.trip_headsign || selectedVehicle.next_stop_name || t('map.vehicleDetails.headingToDestination')}
                                </h3>
                                <HStack justify="center" gap={2} className="flex-wrap">
                            {(() => {
                                const rawDelay = vehicleDetail?.delay ?? selectedVehicle.delay ?? 0;
                                const delayVal = Number(rawDelay);
                                const delayMinutes = Math.round(Math.abs(delayVal) / 60);
                                const isLate = delayVal > 30;
                                const isEarly = delayVal < -30;
                                return (
                                    <StatusPill
                                        variant={isLate ? 'danger' : isEarly ? 'info' : 'success'}
                                        label={isLate
                                            ? t('map.vehicleDetails.delayLabel', { minutes: delayMinutes || 1 })
                                            : isEarly
                                                ? t('map.vehicleDetails.earlyLabel', { minutes: delayMinutes || 1 })
                                                : t('map.vehicleDetails.onTime')}
                                    />
                                );
                            })()}
                            {(vehicleDetail?.origin_timestamp || selectedVehicle?.origin_timestamp) && liveDataAgeSeconds !== null && (
                                    <HStack gap={2} className="px-2.5 py-1 bg-muted/30 rounded-full border border-border">
                                        <Box className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                            {t('map.vehicleDetails.liveDataAge', { seconds: liveDataAgeSeconds })}
                                        </span>
                                    </HStack>
                            )}
                        </HStack>
                    </Stack>
                </HStack>
            </Surface>

            {/* Metadata Grid */}
            <HStack align="stretch" gap={2}>
                <Surface variant="tinted" padding="sm" className="flex-1 min-w-0 justify-between flex flex-row items-center px-3 border-white/10!">
                    <HStack gap={2} className="min-w-0 flex-1 pr-2">
                        <Info size={14} className="text-muted-foreground shrink-0" />
                        <Stack gap={0} className="min-w-0 flex-1">
                            <span className="text-muted-foreground text-[9px] uppercase font-bold tracking-wider truncate block w-full">
                                {vehicleDetail?.vehicle_descriptor?.operator || selectedVehicle?.vehicle_descriptor?.operator}
                            </span>
                            <HStack gap={1} align="center" className="min-w-0 w-full">
                                <span className="text-foreground text-[11px] font-bold truncate shrink">
                                    {vehicleDetail?.vehicle_descriptor?.vehicle_type || selectedVehicle?.vehicle_descriptor?.vehicle_type || '---'}
                                </span>
                                <span className="text-muted-foreground text-[10px] font-semibold shrink-0">
                                    #{vehicleDetail?.vehicle_descriptor?.vehicle_registration_number || selectedVehicle?.vehicle_descriptor?.vehicle_registration_number}
                                </span>
                            </HStack>
                        </Stack>
                    </HStack>
                    <HStack gap={2} className="shrink-0">
                        {(vehicleDetail?.vehicle_descriptor?.is_air_conditioned || selectedVehicle?.vehicle_descriptor?.is_air_conditioned) && (
                            <Snowflake size={14} className="text-sky-400" />
                        )}
                        {(vehicleDetail?.vehicle_descriptor?.has_usb_chargers || selectedVehicle?.vehicle_descriptor?.has_usb_chargers) && (
                            <Zap size={14} className="text-amber-400" />
                        )}
                        {(vehicleDetail?.vehicle_descriptor?.is_wheelchair_accessible || selectedVehicle?.vehicle_descriptor?.is_wheelchair_accessible) && (
                            <Accessibility size={14} className="text-primary" />
                        )}
                    </HStack>
                </Surface>
                {(vehicleDetail?.run_number || selectedVehicle?.run_number) && (
                    <Surface variant="tinted" padding="sm" className="flex-initial min-w-[70px] gap-2 flex flex-row items-center px-3 border-white/10!">
                        <Navigation size={14} className="text-muted-foreground shrink-0" />
                        <Stack gap={0} className="min-w-0">
                            <span className="text-muted-foreground text-[9px] uppercase font-bold tracking-wider truncate">{t('map.vehicleDetails.runNumber')}</span>
                            <span className="text-foreground text-[11px] font-bold">{vehicleDetail?.run_number || selectedVehicle?.run_number}</span>
                        </Stack>
                    </Surface>
                )}
            </HStack>

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
            {vehicleDetail?.stop_times?.features && vehicleDetail.stop_times.features.length > 0 && (
                <Stack gap={3}>
                    <HStack justify="between" className="px-1">
                        <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest">{t('map.vehicleDetails.routeSchedule')}</span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleTogglePastStops}
                            className="h-7 rounded-xl text-[10px] bg-transparent hover:bg-muted/50 text-muted-foreground hover:text-foreground font-bold uppercase tracking-wider px-2 gap-1.5"
                        >
                            {showPastStops ? t('map.vehicleDetails.hidePastStops') : t('map.vehicleDetails.showPastStops')}
                            {showPastStops ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </Button>
                    </HStack>
                    <Box className="relative pl-6">
                        <Box className="absolute left-[11px] top-3 bottom-6 w-0.5 bg-border" />
                        {filteredStops.map((stop, idx: number) => {
                            const stopSeq = Number(stop.properties.stop_sequence);
                            const limit = effectiveSequence ?? 0;
                            const isPast = stopSeq < limit;
                            const isCurrent = stopSeq === effectiveSequence;
                            const isNext = stopSeq === nextStopSequence;

                            const showZone = !!stop.properties.zone_id;

                            return (
                                <HStack key={idx} justify="between" className={cn(
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
                        })}
                    </Box>
                </Stack>
            )}
        </Stack>
    );
});

VehicleDetail.displayName = 'VehicleDetail';
