
import React, { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Info, MapPin, Snowflake, Accessibility, Zap, Navigation, ChevronDown, ChevronUp } from 'lucide-react';
import { StatusPill } from './StatusPill';
import { cn } from '@/lib/utils';
import { getVehicleColor } from '../utils/vehicleColors';
import { useRSS } from '../hooks/useRSS';
import { parseISO } from 'date-fns';
import { GenericAlertCard } from './GenericAlertCard';

import type { TrackedVehicle, VehicleDetail as VehicleDetailType } from '../types/transit';

interface VehicleDetailProps {
    selectedVehicle: TrackedVehicle | null;
    vehicleDetail: VehicleDetailType | null;
    loadingDetail: boolean;
    isFollowing: boolean;
    onToggleFollow: () => void;
}

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

    // Live-updating ticker for data age in seconds
    React.useEffect(() => {
        if (!vehicleDetail?.origin_timestamp && !selectedVehicle?.origin_timestamp) {
            setLiveDataAgeSeconds(null);
            return;
        }

        const updateAge = () => {
            try {
                const tsString = vehicleDetail?.origin_timestamp || selectedVehicle?.origin_timestamp;
                if (!tsString) {
                    setLiveDataAgeSeconds(null);
                    return;
                }
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
    }, [vehicleDetail?.origin_timestamp, selectedVehicle?.origin_timestamp]);

    const routeName = selectedVehicle?.gtfs_route_short_name || selectedVehicle?.route_short_name;

    const relevantAlerts = useMemo(() => {
        const allItems = rssData?.alerts || [];
        if (!routeName) return [];
        return allItems.filter(item =>
            item.lines?.some((l: string) => l.toUpperCase() === routeName.toString().toUpperCase()) &&
            item.isActive
        );
    }, [rssData, routeName]);

    // Prefer high-frequency sequence from selectedVehicle (map stream) over vehicleDetail (REST API)
    const effectiveSequence = useMemo(() => {
        return selectedVehicle?.last_stop_sequence ?? vehicleDetail?.last_stop_sequence ?? null;
    }, [selectedVehicle?.last_stop_sequence, vehicleDetail?.last_stop_sequence]);

    // Memoize next stop sequence calculation to avoid O(n²) complexity
    const nextStopSequence = useMemo(() => {
        if (!vehicleDetail?.stop_times?.features || effectiveSequence === null) return null;

        const futureStops = vehicleDetail.stop_times.features
            .filter((s) => s.properties.stop_sequence > effectiveSequence)
            .sort((a, b) => a.properties.stop_sequence - b.properties.stop_sequence);

        return futureStops[0]?.properties.stop_sequence ?? null;
    }, [vehicleDetail, effectiveSequence]);

    // Memoize filtered stops to prevent re-filtering on every render
    const filteredStops = useMemo(() => {
        if (!vehicleDetail?.stop_times?.features) return [];

        return vehicleDetail.stop_times.features.filter((stop) =>
            showPastStops || stop.properties.stop_sequence >= (effectiveSequence || 0)
        );
    }, [vehicleDetail, showPastStops, effectiveSequence]);

    // Memoize toggle handler to prevent unnecessary re-renders
    const handleTogglePastStops = useCallback(() => {
        setShowPastStops(prev => !prev);
    }, []);

    if (!selectedVehicle) return null;

    return (
        <div className="space-y-4">
            {/* Loading State */}
            {loadingDetail && !vehicleDetail && (
                <div className="py-8 flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                    <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{t('map.vehicleDetails.fetching')}</span>
                </div>
            )}

            {/* Warning: Before Track / Previous Trip */}
            {((['before_track', 'before_track_delayed'] as string[]).includes(selectedVehicle.state_position || '') || (['before_track', 'before_track_delayed'] as string[]).includes(vehicleDetail?.state_position || '')) && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-4">
                    <div className="p-2 bg-amber-500/20 rounded-full text-amber-500 shrink-0">
                        <Info size={20} />
                    </div>
                    <div>
                        <h4 className="text-amber-500 font-bold text-sm">{t('map.vehicleDetails.previousTrip')}</h4>
                        <p className="text-amber-500/80 text-xs mt-1 leading-relaxed">
                            {t('map.vehicleDetails.previousTripDescription')}
                        </p>
                    </div>
                </div>
            )}

            <div className="flex flex-row md:flex-col items-center md:text-center p-4 md:p-6 bg-white/5 rounded-3xl border border-white/10 relative overflow-hidden gap-3 md:gap-4">
                <div
                    className="absolute inset-0 opacity-10"
                    style={{ backgroundColor: getVehicleColor(selectedVehicle.route_type || 0, selectedVehicle.gtfs_route_short_name || selectedVehicle.route_short_name || '') }}
                />
                <div
                    className="w-14 h-14 md:w-16 md:h-16 shrink-0 rounded-2xl flex flex-col items-center justify-center shadow-2xl z-10 relative group cursor-pointer"
                    style={{ backgroundColor: getVehicleColor(selectedVehicle.route_type || 0, selectedVehicle.gtfs_route_short_name || selectedVehicle.route_short_name || '') }}
                    onClick={onToggleFollow}
                >
                    <span className="text-2xl md:text-3xl font-black text-white">{selectedVehicle.gtfs_route_short_name || selectedVehicle.route_short_name}</span>
                    <div className={cn(
                        "absolute -bottom-1 -right-1 w-5 h-5 md:w-6 md:h-6 rounded-full border-2 border-black flex items-center justify-center transition-colors",
                        isFollowing ? "bg-emerald-500" : "bg-zinc-700"
                    )}>
                        <MapPin size={isFollowing ? 10 : 12} className="text-white" />
                    </div>
                </div>
                <div className="z-10 flex-1 min-w-0 md:w-full">
                    <h3 className="text-lg md:text-xl font-bold text-white mb-1 truncate">
                        {vehicleDetail?.trip_headsign || selectedVehicle.gtfs_trip_headsign || selectedVehicle.trip_headsign || selectedVehicle.next_stop_name || t('map.vehicleDetails.headingToDestination')}
                    </h3>
                    <div className="flex items-center md:justify-center gap-2 flex-wrap">
                        {(() => {
                            const rawDelay = vehicleDetail?.delay ?? selectedVehicle.delay ?? 0;
                            const delayMinutes = Math.round(Math.abs(rawDelay) / 60);
                            const isLate = rawDelay > 30; // Threshold of 30s for the minute-based label
                            const isEarly = rawDelay < -30;

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
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 rounded-full border border-white/5">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                                    {t('map.vehicleDetails.liveDataAge', { seconds: liveDataAgeSeconds })}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {(vehicleDetail?.vehicle_descriptor?.operator || selectedVehicle?.vehicle_descriptor?.operator) && (
                <div className="flex gap-2">
                    <div className="flex-1 min-w-0 p-3 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                            <Info size={14} className="text-zinc-500 shrink-0" />
                            <div className="flex flex-col min-w-0">
                                <span className="text-zinc-500 text-[9px] uppercase font-bold tracking-wider truncate">
                                    {vehicleDetail?.vehicle_descriptor?.operator || selectedVehicle?.vehicle_descriptor?.operator}
                                </span>
                                <span className="text-white text-[11px] font-bold truncate">
                                    #{vehicleDetail?.vehicle_descriptor?.vehicle_registration_number || selectedVehicle?.vehicle_descriptor?.vehicle_registration_number || selectedVehicle?.vehicle_registration_number || '---'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {(vehicleDetail?.vehicle_descriptor?.is_air_conditioned || selectedVehicle?.vehicle_descriptor?.is_air_conditioned || selectedVehicle?.is_air_conditioned) && (
                                <Snowflake size={14} className="text-cyan-400" />
                            )}
                            {(vehicleDetail?.vehicle_descriptor?.has_usb_chargers || selectedVehicle?.vehicle_descriptor?.has_usb_chargers || selectedVehicle?.usb_chargers) && (
                                <Zap size={14} className="text-yellow-400" />
                            )}
                            {(vehicleDetail?.vehicle_descriptor?.is_wheelchair_accessible || selectedVehicle?.vehicle_descriptor?.is_wheelchair_accessible || selectedVehicle?.is_wheelchair_accessible) && (
                                <Accessibility size={14} className="text-emerald-500" />
                            )}
                        </div>
                    </div>
                    {(vehicleDetail?.run_number || selectedVehicle?.run_number) && (
                        <div className="flex-initial min-w-[70px] p-3 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-2">
                            <Navigation size={14} className="text-zinc-500 shrink-0" />
                            <div className="flex flex-col min-w-0">
                                <span className="text-zinc-500 text-[9px] uppercase font-bold tracking-wider truncate">{t('map.vehicleDetails.runNumber')}</span>
                                <span className="text-white text-[11px] font-bold">{vehicleDetail?.run_number || selectedVehicle?.run_number}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {relevantAlerts.length > 0 && (
                <div className="space-y-2">
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
                </div>
            )}

            {vehicleDetail?.stop_times?.features && vehicleDetail.stop_times.features.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1 gap-2">
                        <span className="text-zinc-500 text-[10px] uppercase font-black tracking-widest truncate">{t('map.vehicleDetails.routeSchedule')}</span>
                        <button
                            onClick={handleTogglePastStops}
                            className="flex items-center gap-1.5 px-2 py-1 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-colors shrink-0"
                        >
                            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider whitespace-nowrap">
                                {showPastStops ? t('map.vehicleDetails.hidePastStops') : t('map.vehicleDetails.showPastStops')}
                            </span>
                            {showPastStops ? <ChevronUp size={12} className="text-zinc-400" /> : <ChevronDown size={12} className="text-zinc-400" />}
                        </button>
                    </div>
                    <div className="relative pl-6 space-y-0">
                        <div className="absolute left-[11px] top-3 bottom-6 w-0.5 bg-white/10" />

                        {filteredStops.map((stop, idx: number) => {
                            const isPast = stop.properties.stop_sequence < (effectiveSequence || 0);
                            const isCurrent = stop.properties.stop_sequence === effectiveSequence;
                            const isNext = stop.properties.stop_sequence === nextStopSequence;

                            return (
                                <div key={idx} className={cn(
                                    "relative py-2.5 flex items-center justify-between transition-opacity",
                                    isPast ? "opacity-40" : "opacity-100"
                                )}>
                                    <div className={cn(
                                        "absolute -left-[19px] w-2.5 h-2.5 rounded-full border-2 border-zinc-900 z-10",
                                        isCurrent ? "bg-emerald-500 ring-4 ring-emerald-500/20" : isPast ? "bg-zinc-600" : "bg-white/20"
                                    )} />

                                    <div className="flex flex-col min-w-0 pr-4">
                                        <span className={cn(
                                            "text-sm truncate",
                                            isNext ? "text-emerald-400 font-bold" : isPast ? "text-zinc-400" : "text-zinc-100 font-medium"
                                        )}>
                                            {stop.properties.stop_name}
                                        </span>
                                        {isCurrent && <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">{t('map.vehicleDetails.currentStop')}</span>}
                                        {isNext && <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">{t('map.vehicleDetails.nextStop')}</span>}
                                    </div>

                                    <div className="flex flex-col items-end shrink-0">
                                        {(() => {
                                            const { realtime_arrival_time, arrival_time } = stop.properties;
                                            const realtimeTime = realtime_arrival_time || arrival_time;
                                            const scheduledTime = arrival_time;
                                            const hasRealtime = !!realtime_arrival_time && realtime_arrival_time !== arrival_time;
                                            const isEarly = hasRealtime && realtime_arrival_time < arrival_time;
                                            const isLate = hasRealtime && realtime_arrival_time > arrival_time;

                                            return (
                                                <React.Fragment>
                                                    <span className={cn(
                                                        "text-xs tabular-nums",
                                                        isPast ? "text-zinc-600" : isEarly ? "text-emerald-400" : isLate ? "text-rose-400" : "text-zinc-400"
                                                    )}>
                                                        {realtimeTime?.slice(0, 8) || ''}
                                                    </span>
                                                    {hasRealtime && (
                                                        <span className="text-[9px] text-zinc-500 tabular-nums">
                                                            {t('map.vehicleDetails.scheduledTime')} {scheduledTime?.slice(0, 8) || ''}
                                                        </span>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })()}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
});

VehicleDetail.displayName = 'VehicleDetail';
