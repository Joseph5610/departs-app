import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Info, MapPin, Snowflake, Accessibility,
    Zap, Navigation, ChevronDown, ChevronUp,
    AlertTriangle, ExternalLink
} from 'lucide-react';
import { StatusPill } from './StatusPill';
import { getVehicleColor } from '../utils/vehicleColors';
import { useRSS } from '../hooks/useRSS';
import { parseISO, differenceInSeconds } from 'date-fns';

import type { TrackedVehicle, VehicleDetail as VehicleDetailType, RSSItem } from '../types/transit';

interface VehicleDetailProps {
    selectedVehicle: TrackedVehicle | null;
    vehicleDetail: VehicleDetailType | null;
    loadingDetail: boolean;
    isFollowing: boolean;
    onToggleFollow: () => void;
}

/**
 * Renders detailed information about a selected vehicle, including its route,
 * delay, features (A/C, USB), active alerts, and upcoming stops.
 */
export const VehicleDetail = React.memo<VehicleDetailProps>(({
    selectedVehicle,
    vehicleDetail,
    loadingDetail,
    isFollowing,
    onToggleFollow
}) => {
    const { t } = useTranslation();
    const { data: incidents } = useRSS('incidents');
    const { data: exclusions } = useRSS('exclusions');
    const [showPastStops, setShowPastStops] = useState(false);
    const [tick, setTick] = useState(0);

    // Derive the timestamp string from either the details or the selected vehicle summary
    const tsString = vehicleDetail?.origin_timestamp || selectedVehicle?.origin_timestamp;

    // Ticker effect to trigger a re-render every second for the data age display
    useEffect(() => {
        if (!tsString) return;
        const interval = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, [tsString]);

    // Compute live data age in seconds, updating whenever the ticker or the timestamp changes
    const liveDataAgeSeconds = useMemo(() => {
        if (!tsString) return null;
        try {
            // We reference 'tick' to ensure useMemo re-calculates every second even if tsString is stable
            return tick > -1 ? differenceInSeconds(new Date(), parseISO(tsString)) : null;
        } catch {
            return null;
        }
    }, [tsString, tick]);

    const routeShortName = selectedVehicle?.gtfs_route_short_name || selectedVehicle?.route_short_name;
    const routeType = selectedVehicle?.route_type || 0;

    // Filter alerts that are relevant to this specific route
    const relevantAlerts = useMemo(() => {
        if (!routeShortName) return [];
        const allItems = [...(incidents?.items || []), ...(exclusions?.items || [])];
        const normalizedName = routeShortName.toString().toUpperCase();

        return allItems.filter((item: RSSItem) =>
            item.isActive && item.lines?.some((l: string) => l.toUpperCase() === normalizedName)
        );
    }, [incidents, exclusions, routeShortName]);

    // Identify the next stop in the sequence
    const nextStopSequence = useMemo(() => {
        if (!vehicleDetail?.stop_times?.features || !vehicleDetail.last_stop_sequence) return null;

        const lastSequence = vehicleDetail.last_stop_sequence;
        const futureStops = vehicleDetail.stop_times.features
            .filter((s) => s.properties.stop_sequence > lastSequence)
            .sort((a, b) => a.properties.stop_sequence - b.properties.stop_sequence);

        return futureStops[0]?.properties.stop_sequence ?? null;
    }, [vehicleDetail]);

    // Filter and sort stops for display based on user preference (show/hide past stops)
    const filteredStops = useMemo(() => {
        if (!vehicleDetail?.stop_times?.features) return [];

        const lastSequence = vehicleDetail.last_stop_sequence || 0;
        return vehicleDetail.stop_times.features
            .filter((stop) => showPastStops || stop.properties.stop_sequence >= lastSequence)
            .sort((a, b) => a.properties.stop_sequence - b.properties.stop_sequence);
    }, [vehicleDetail, showPastStops]);

    const handleTogglePastStops = useCallback(() => {
        setShowPastStops(prev => !prev);
    }, []);

    if (!selectedVehicle) return null;

    const vehicleColor = getVehicleColor(routeType, routeShortName || '');

    return (
        <div className="space-y-4">
            {/* Loading Indicator */}
            {loadingDetail && !vehicleDetail && (
                <div className="py-8 flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                    <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{t('map.vehicleDetails.fetching')}</span>
                </div>
            )}

            {/* Warning for vehicles that haven't started their current trip yet */}
            {((selectedVehicle.state_position || vehicleDetail?.state_position)?.includes('before_track')) && (
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

            {/* Main Vehicle Header Panel */}
            <div className="flex flex-row md:flex-col items-center md:text-center p-4 md:p-6 bg-white/5 rounded-3xl border border-white/10 relative overflow-hidden gap-3 md:gap-4">
                <div
                    className="absolute inset-0 opacity-10 pointer-events-none"
                    style={{ backgroundColor: vehicleColor }}
                />
                <div
                    className="w-14 h-14 md:w-16 md:h-16 shrink-0 rounded-2xl flex flex-col items-center justify-center shadow-2xl z-10 relative group cursor-pointer"
                    style={{ backgroundColor: vehicleColor }}
                    onClick={onToggleFollow}
                >
                    <span className="text-2xl md:text-3xl font-black text-white">{routeShortName}</span>
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 md:w-6 md:h-6 rounded-full border-2 border-black flex items-center justify-center transition-colors ${isFollowing ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                        <MapPin size={isFollowing ? 10 : 12} className="text-white" />
                    </div>
                </div>
                <div className="z-10 flex-1 min-w-0 md:w-full">
                    <h3 className="text-lg md:text-xl font-bold text-white mb-1 truncate">
                        {vehicleDetail?.trip_headsign || selectedVehicle.gtfs_trip_headsign || selectedVehicle.trip_headsign || selectedVehicle.next_stop_name || t('map.vehicleDetails.headingToDestination')}
                    </h3>
                    <div className="flex items-center md:justify-center gap-2 flex-wrap">
                        <StatusPill
                            variant={(vehicleDetail?.delay ?? selectedVehicle.delay ?? 0) > 30 ? 'danger' : 'success'}
                            label={(vehicleDetail?.delay ?? selectedVehicle.delay ?? 0) > 30
                                ? t('map.vehicleDetails.delayLabel', { minutes: Math.round((vehicleDetail?.delay ?? selectedVehicle.delay ?? 0) / 60) })
                                : t('map.vehicleDetails.onTime')}
                        />

                        {liveDataAgeSeconds !== null && (
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

            {/* Vehicle Metadata and Features (Operator, A/C, Accessibility) */}
            {(vehicleDetail?.vehicle_descriptor?.operator || selectedVehicle?.operator) && (
                <div className="flex gap-2">
                    <div className="flex-1 min-w-0 p-3 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                            <Info size={14} className="text-zinc-500 shrink-0" />
                            <div className="flex flex-col min-w-0">
                                <span className="text-zinc-500 text-[9px] uppercase font-bold tracking-wider truncate">
                                    {vehicleDetail?.vehicle_descriptor?.operator || selectedVehicle?.operator}
                                </span>
                                <span className="text-white text-[11px] font-bold truncate">
                                    #{vehicleDetail?.vehicle_descriptor?.vehicle_registration_number || selectedVehicle?.vehicle_registration_number || '---'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {(vehicleDetail?.vehicle_descriptor?.is_air_conditioned || selectedVehicle?.is_air_conditioned) && (
                                <Snowflake size={14} className="text-cyan-400" />
                            )}
                            {(vehicleDetail?.vehicle_descriptor?.has_usb_chargers || selectedVehicle?.usb_chargers || selectedVehicle?.has_usb_chargers) && (
                                <Zap size={14} className="text-yellow-400" />
                            )}
                            {(vehicleDetail?.vehicle_descriptor?.is_wheelchair_accessible || selectedVehicle?.is_wheelchair_accessible) && (
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

            {/* Active Service Alerts */}
            {relevantAlerts.length > 0 && (
                <div className="space-y-2">
                    {relevantAlerts.map((alert, idx) => (
                        <a
                            key={alert.guid || idx}
                            href={alert.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`p-4 rounded-2xl border flex items-start gap-4 transition-all hover:bg-white/5 group
                                ${alert.priority === '1' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-amber-500/10 border-amber-500/20'}
                            `}
                        >
                            <div className={`p-2 rounded-full shrink-0 ${alert.priority === '1' ? 'bg-rose-500/20 text-rose-500' : 'bg-amber-500/20 text-amber-500'}`}>
                                <AlertTriangle size={20} className={alert.priority === '1' ? 'animate-pulse' : ''} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start gap-2">
                                    <h4 className={`font-bold text-sm leading-tight ${alert.priority === '1' ? 'text-rose-500' : 'text-amber-500'}`}>
                                        {alert.title}
                                    </h4>
                                    <ExternalLink size={14} className="text-zinc-600 group-hover:text-zinc-400 shrink-0 mt-0.5" />
                                </div>
                                <p className="text-zinc-400 text-[10px] mt-1 line-clamp-2">
                                    {alert.contentSnippet || alert.date}
                                </p>
                            </div>
                        </a>
                    ))}
                </div>
            )}

            {/* Route Schedule (Stop Times) */}
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
                        {/* Vertical Timeline Line */}
                        <div className="absolute left-[11px] top-3 bottom-6 w-0.5 bg-white/10" />

                        {filteredStops.map((stop, idx: number) => {
                            const sequence = stop.properties.stop_sequence;
                            const isPast = sequence < (vehicleDetail.last_stop_sequence || 0);
                            const isCurrent = sequence === vehicleDetail.last_stop_sequence;
                            const isNext = sequence === nextStopSequence;

                            const realtime = stop.properties.realtime_arrival_time;
                            const scheduled = stop.properties.arrival_time;
                            const displayTime = realtime || scheduled;
                            const hasRealtime = !!(realtime && realtime !== scheduled);

                            return (
                                <div key={idx} className={`relative py-2.5 flex items-center justify-between transition-opacity ${isPast ? 'opacity-40' : 'opacity-100'}`}>
                                    {/* Stop Dot on Timeline */}
                                    <div className={`absolute -left-[19px] w-2.5 h-2.5 rounded-full border-2 border-zinc-900 z-10 
                                        ${isCurrent ? 'bg-emerald-500 ring-4 ring-emerald-500/20' : isPast ? 'bg-zinc-600' : 'bg-white/20'}`}
                                    />

                                    <div className="flex flex-col min-w-0 pr-4">
                                        <span className={`text-sm truncate ${isNext ? 'text-emerald-400 font-bold' : isPast ? 'text-zinc-400' : 'text-zinc-100 font-medium'}`}>
                                            {stop.properties.stop_name}
                                        </span>
                                        {isCurrent && <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">{t('map.vehicleDetails.currentStop')}</span>}
                                        {isNext && <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">{t('map.vehicleDetails.nextStop')}</span>}
                                    </div>

                                    <div className="flex flex-col items-end shrink-0">
                                        <span className={`text-xs font-mono ${isPast ? 'text-zinc-600' : hasRealtime ? (realtime < scheduled ? 'text-emerald-400' : 'text-rose-400') : 'text-zinc-400'}`}>
                                            {displayTime?.slice(0, 8) || ''}
                                        </span>
                                        {hasRealtime && (
                                            <span className="text-[9px] text-zinc-500 font-mono">
                                                {t('map.vehicleDetails.scheduledTime')} {scheduled?.slice(0, 8) || ''}
                                            </span>
                                        )}
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
