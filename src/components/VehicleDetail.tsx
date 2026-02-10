
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Info, MapPin, Snowflake, Accessibility, Zap, Navigation, ChevronDown, ChevronUp } from 'lucide-react';
import { StatusPill } from './StatusPill';
import { getVehicleColor } from '../utils/vehicleColors';
import { useRSS } from '../hooks/useRSS';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { isAlertActive } from '../utils/dateUtils';
import { parseISO } from 'date-fns';

interface VehicleDetailProps {
    selectedVehicle: any;
    vehicleDetail: any;
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
    const { data: incidents } = useRSS('incidents');
    const { data: exclusions } = useRSS('exclusions');
    const [showPastStops, setShowPastStops] = useState(false);
    const [liveDataAgeSeconds, setLiveDataAgeSeconds] = useState<number | null>(null);

    // Live-updating ticker for data age in seconds
    React.useEffect(() => {
        if (!vehicleDetail?.origin_timestamp) {
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

        // Update immediately
        updateAge();

        // Then update every second
        const interval = setInterval(updateAge, 1000);

        return () => clearInterval(interval);
    }, [vehicleDetail?.origin_timestamp]);

    const routeName = selectedVehicle?.gtfs_route_short_name || selectedVehicle?.route_short_name || selectedVehicle?.n;

    const relevantAlerts = useMemo(() => {
        const allItems = [...(incidents?.items || []), ...(exclusions?.items || [])];
        if (!routeName) return [];
        return allItems.filter(item =>
            item.lines?.some(l => l.toUpperCase() === routeName.toString().toUpperCase()) &&
            isAlertActive(item)
        );
    }, [incidents, exclusions, routeName]);

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
            {(['before_track', 'before_track_delayed'].includes(selectedVehicle.state_position) || ['before_track', 'before_track_delayed'].includes(vehicleDetail?.state_position || '')) && (
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

            <div className="flex flex-row md:flex-col items-center md:text-center p-3 md:p-8 bg-white/5 rounded-3xl border border-white/10 relative overflow-hidden gap-4 md:gap-6">
                <div
                    className="absolute inset-0 opacity-10"
                    style={{ backgroundColor: getVehicleColor(selectedVehicle.route_type || selectedVehicle.t, selectedVehicle.gtfs_route_short_name || selectedVehicle.route_short_name || selectedVehicle.n) }}
                />
                <div
                    className="w-14 h-14 md:w-20 md:h-20 shrink-0 rounded-2xl flex flex-col items-center justify-center shadow-2xl z-10 relative group cursor-pointer"
                    style={{ backgroundColor: getVehicleColor(selectedVehicle.route_type || selectedVehicle.t, selectedVehicle.gtfs_route_short_name || selectedVehicle.route_short_name || selectedVehicle.n) }}
                    onClick={onToggleFollow}
                >
                    <span className="text-2xl md:text-3xl font-black text-white">{selectedVehicle.gtfs_route_short_name || selectedVehicle.route_short_name || selectedVehicle.n}</span>
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
                            variant={(vehicleDetail?.delay ?? selectedVehicle.delay ?? selectedVehicle.d ?? 0) > 30 ? 'danger' : 'success'}
                            label={(vehicleDetail?.delay ?? selectedVehicle.delay ?? selectedVehicle.d ?? 0) > 30
                                ? t('map.vehicleDetails.delayLabel', { minutes: Math.round((vehicleDetail?.delay ?? selectedVehicle.delay ?? selectedVehicle.d ?? 0) / 60) })
                                : t('map.vehicleDetails.onTime')}
                        />
                        {(vehicleDetail?.vehicle_descriptor?.is_air_conditioned || selectedVehicle?.vehicle_descriptor?.is_air_conditioned || selectedVehicle?.is_air_conditioned) && (
                            <StatusPill
                                variant="info"
                                label={t('map.vehicleDetails.ac')}
                                icon={<Snowflake size={10} />}
                            />
                        )}
                        {(vehicleDetail?.vehicle_descriptor?.has_usb_chargers || selectedVehicle?.vehicle_descriptor?.has_usb_chargers || selectedVehicle?.usb_chargers) && (
                            <StatusPill
                                variant="info"
                                label="USB"
                                icon={<Zap size={10} />}
                            />
                        )}
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


            {/* Operator & Vehicle Info - Compact on mobile */}
            {(vehicleDetail?.vehicle_descriptor?.operator || selectedVehicle?.vehicle_descriptor?.operator) && (
                <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
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
                        {(vehicleDetail?.vehicle_descriptor?.is_wheelchair_accessible || selectedVehicle?.vehicle_descriptor?.is_wheelchair_accessible || selectedVehicle?.is_wheelchair_accessible) && (
                            <Accessibility size={14} className="text-emerald-500 shrink-0" />
                        )}
                    </div>
                    {(vehicleDetail?.run_number || selectedVehicle?.run_number) && (
                        <div className="p-3 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-2">
                            <Navigation size={14} className="text-zinc-500 shrink-0" />
                            <div className="flex flex-col">
                                <span className="text-zinc-500 text-[9px] uppercase font-bold tracking-wider">{t('map.vehicleDetails.runNumber')}</span>
                                <span className="text-white text-[11px] font-bold">{vehicleDetail?.run_number || selectedVehicle?.run_number}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}


            {/* RSS Alerts Integration */}
            {relevantAlerts.length > 0 && (
                <div className="space-y-2">
                    {relevantAlerts.map((alert, idx) => (
                        <a
                            key={alert.guid || idx}
                            href={alert.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`p-4 rounded-2xl border flex items-start gap-4 transition-all hover:bg-white/5 group
                                ${alert.priority === '1'
                                    ? 'bg-rose-500/10 border-rose-500/20'
                                    : 'bg-amber-500/10 border-amber-500/20'}
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

            {/* Itinerary - FULL LIST */}
            {vehicleDetail?.stop_times?.features && vehicleDetail.stop_times.features.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <span className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">{t('map.vehicleDetails.routeSchedule')}</span>
                        <button
                            onClick={() => setShowPastStops(!showPastStops)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-colors"
                        >
                            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                                {showPastStops ? t('map.vehicleDetails.hidePastStops') : t('map.vehicleDetails.showPastStops')}
                            </span>
                            {showPastStops ? <ChevronUp size={12} className="text-zinc-400" /> : <ChevronDown size={12} className="text-zinc-400" />}
                        </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto pr-2 custom-scrollbar relative pl-6 space-y-0">
                        {/* Connection Line */}
                        <div className="absolute left-[11px] top-3 bottom-6 w-0.5 bg-white/10" />

                        {vehicleDetail.stop_times.features
                            .filter((stop: any) => showPastStops || stop.properties.stop_sequence >= (vehicleDetail.last_stop_sequence || 0))
                            .map((stop: any, idx: number) => {
                                const isPast = stop.properties.stop_sequence < (vehicleDetail.last_stop_sequence || 0);
                                const isCurrent = stop.properties.stop_sequence === vehicleDetail.last_stop_sequence;
                                const isNext = stop.properties.stop_sequence > (vehicleDetail.last_stop_sequence || 0) &&
                                    !vehicleDetail.stop_times.features.some((s: any) =>
                                        s.properties.stop_sequence > (vehicleDetail.last_stop_sequence || 0) &&
                                        s.properties.stop_sequence < stop.properties.stop_sequence
                                    );

                                return (
                                    <div key={idx} className={`relative py-2.5 flex items-center justify-between transition-opacity ${isPast ? 'opacity-40' : 'opacity-100'}`}>
                                        {/* Indicator Dot */}
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
                                            {(() => {
                                                const realtimeTime = stop.properties.realtime_arrival_time || stop.properties.arrival_time;
                                                const scheduledTime = stop.properties.arrival_time;
                                                const hasRealtime = stop.properties.realtime_arrival_time && stop.properties.realtime_arrival_time !== stop.properties.arrival_time;
                                                const isEarly = hasRealtime && stop.properties.realtime_arrival_time < stop.properties.arrival_time;
                                                const isLate = hasRealtime && stop.properties.realtime_arrival_time > stop.properties.arrival_time;

                                                return (
                                                    <>
                                                        <span className={`text-xs font-mono ${isPast ? 'text-zinc-600' : isEarly ? 'text-emerald-400' : isLate ? 'text-rose-400' : 'text-zinc-400'}`}>
                                                            {realtimeTime?.slice(0, 8)}
                                                        </span>
                                                        {hasRealtime && (
                                                            <span className="text-[9px] text-zinc-500 font-mono">
                                                                {t('map.vehicleDetails.scheduledTime')} {scheduledTime?.slice(0, 8)}
                                                            </span>
                                                        )}
                                                    </>
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
