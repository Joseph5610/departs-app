
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Info, MapPin, Snowflake, Accessibility } from 'lucide-react';
import { StatusPill } from './StatusPill';
import { getVehicleColor } from '../utils/vehicleColors';

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

            <div className="flex flex-row md:flex-col items-center md:text-center p-4 md:p-8 bg-white/5 rounded-3xl border border-white/10 relative overflow-hidden gap-4 md:gap-6">
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
                    <div className="flex items-center md:justify-center gap-2">
                        <StatusPill
                            variant={(vehicleDetail?.delay ?? selectedVehicle.delay ?? selectedVehicle.d ?? 0) > 30 ? 'danger' : 'success'}
                            label={(vehicleDetail?.delay ?? selectedVehicle.delay ?? selectedVehicle.d ?? 0) > 30
                                ? t('map.vehicleDetails.delayLabel', { minutes: Math.round((vehicleDetail?.delay ?? selectedVehicle.delay ?? selectedVehicle.d ?? 0) / 60) })
                                : t('map.vehicleDetails.onTime')}
                        />
                        {vehicleDetail?.vehicle_descriptor?.is_air_conditioned && (
                            <StatusPill
                                variant="info"
                                label={t('map.vehicleDetails.ac')}
                                icon={<Snowflake size={10} />}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Operator & Vehicle Info - Compact on mobile */}
            {vehicleDetail?.vehicle_descriptor?.operator && (
                <div className="flex flex-row items-center justify-between md:p-4 p-1 md:bg-white/5 md:border md:border-white/5 rounded-2xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/5 rounded-xl text-zinc-400 hidden md:block">
                            <Info size={16} />
                        </div>
                        <div className="flex flex-col md:block">
                            <div className="text-white text-sm font-semibold hidden md:block">
                                {vehicleDetail.vehicle_descriptor.operator}
                            </div>
                            <div className="text-zinc-500 text-[10px]">
                                <span className="md:hidden font-bold text-zinc-400">{t('map.vehicleDetails.operator', { operator: vehicleDetail.vehicle_descriptor.operator })}</span>
                                {vehicleDetail.vehicle_descriptor.vehicle_type || t('map.vehicleDetails.vehicle')}
                                {vehicleDetail.vehicle_descriptor.vehicle_registration_number ? ` • #${vehicleDetail.vehicle_descriptor.vehicle_registration_number}` : ''}
                            </div>
                        </div>
                    </div>
                    {vehicleDetail.vehicle_descriptor.is_wheelchair_accessible && (
                        <div className="text-emerald-500 shrink-0">
                            <Accessibility size={16} />
                        </div>
                    )}
                </div>
            )}

            {/* Itinerary - ONLY if available */}
            {vehicleDetail?.stop_times?.features && vehicleDetail.stop_times.features.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <span className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">{t('map.vehicleDetails.routeSchedule')}</span>
                    </div>
                    <div className="space-y-0.5 relative pl-4">
                        <div className="absolute left-1 top-2 bottom-6 w-0.5 bg-white/10" />

                        {vehicleDetail.stop_times.features
                            .filter((s: any) => s.properties.stop_sequence > (vehicleDetail.last_stop_sequence || 0))
                            .slice(0, 3)
                            .map((stop: any, idx: number) => (
                                <div key={idx} className="relative py-2 flex items-center justify-between">
                                    <div className="absolute -left-3.5 w-1.5 h-1.5 rounded-full bg-white/30 border border-black" />
                                    <span className="text-zinc-200 text-sm font-medium truncate pr-4">{stop.properties.stop_name}</span>
                                    <span className="text-zinc-500 text-xs font-mono shrink-0">{stop.properties.arrival_time?.slice(0, 5)}</span>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* Basic Metadata - Desktop only to save space on mobile */}
            <div className="hidden md:grid grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1">{t('map.vehicleDetails.vehicleId')}</div>
                    <div className="text-white font-mono text-xs truncate">{selectedVehicle.vehicle_id || selectedVehicle.id || t('map.vehicleDetails.notAvailable')}</div>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1">{t('map.vehicleDetails.status')}</div>
                    <div className="text-white text-xs capitalize">{selectedVehicle.state_position?.replace(/_/g, ' ') || t('map.vehicleDetails.inTransit')}</div>
                </div>
            </div>
        </div>
    );
});

VehicleDetail.displayName = 'VehicleDetail';
