
import { memo, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownAz, Clock, MoonStar, Star, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, type Locale } from 'date-fns';
import { cs } from 'date-fns/locale/cs';
import { enUS } from 'date-fns/locale/en-US';
import { VehicleDetail } from './VehicleDetail';
import { Countdown } from './Countdown';
import { getVehicleColor } from '../utils/vehicleColors';
import type { Departure } from '../types/transit';
import { useMap } from '../hooks/useMap';
import { useVehicleDetail } from '../hooks/useVehicleDetail';
import { useGroupedDepartures } from '../hooks/useGroupedDepartures';
import { useDepartures } from '../hooks/useDepartures';
import { METRO_STATIONS } from '../config/stations';
import { calculateDistance, getCatchStatus } from '../utils/transitLogic';

const dateLocales: Record<string, Locale> = {
    cs: cs,
    en: enUS
};

const formatDelay = (seconds: number) => {
    if (seconds <= 30) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `+${secs}s`;
    return `+${mins}:${secs.toString().padStart(2, '0')}`;
};

const DelayDelta = ({ delta, lastUpdate, isInline = false }: { delta: number; lastUpdate?: number; isInline?: boolean }) => {
    const [isTimedOut, setIsTimedOut] = useState(false);
    const [lastHandledUpdate, setLastHandledUpdate] = useState<number | undefined>(undefined);

    // Reset timeout state when the update timestamp changes.
    // This uses the pattern of updating state during render to synchronize with props.
    if (lastUpdate !== lastHandledUpdate) {
        setLastHandledUpdate(lastUpdate);
        setIsTimedOut(false);
    }

    // eslint-disable-next-line react-hooks/purity
    const isFresh = delta !== 0 && !!lastUpdate && (Date.now() - lastUpdate < 5000);
    const visible = isFresh && !isTimedOut;

    useEffect(() => {
        if (visible && lastUpdate) {
            const age = Date.now() - lastUpdate;
            const timer = setTimeout(() => setIsTimedOut(true), 5000 - age);
            return () => clearTimeout(timer);
        }
    }, [visible, lastUpdate]);

    return (
        <AnimatePresence>
            {visible && delta !== 0 && (
                <motion.span
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 5 }}
                    className={`px-1 rounded text-[9px] font-bold tabular-nums ${isInline ? 'ml-1' : ''} ${delta > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}
                >
                    {delta > 0 ? `+${delta}s` : `${delta}s`}
                </motion.span>
            )}
        </AnimatePresence>
    );
};

interface DetailPanelContentProps {
    onToggleFollow: () => void;
}

export const DetailPanelContent = memo<DetailPanelContentProps>(({
    onToggleFollow
}) => {
    const { t, i18n } = useTranslation();
    const { state, actions } = useMap();

    // Data Hooks
    const { data: vehicleDetail, isFetching: loadingDetail } = useVehicleDetail();
    const { isLoading: loadingDeps } = useDepartures();
    const groupedDepartures = useGroupedDepartures();

    const { selectedStop, selectedVehicle, isFollowing, expandedGroups, departureSort, userLocation, favoriteStops } = state;
    const { setDepartureSort, toggleGroup: onToggleGroup, handleDepartureClick: onDepartureClick, toggleFavorite } = actions;

    const showDepartureBoard = selectedStop && !selectedVehicle;

    const isFavorite = selectedStop ? favoriteStops.includes(selectedStop.id) : false;

    const stopDistanceInfo = useMemo(() => {
        if (!selectedStop?.coordinates || !userLocation) return null;
        const distance = calculateDistance(userLocation, selectedStop.coordinates);
        const { walkingTimeMin } = getCatchStatus(distance, new Date().toISOString());
        return { distance: Math.round(distance), time: walkingTimeMin };
    }, [selectedStop?.coordinates, userLocation]);

    const showMetroNightMessage = useMemo(() => {
        if (!showDepartureBoard || !selectedStop || groupedDepartures.length > 0 || loadingDeps) return false;

        const isMetroStation = !!METRO_STATIONS[selectedStop.name];
        const hour = new Date().getHours();
        const isNightTime = hour >= 0 && hour < 5;

        return isMetroStation && isNightTime;
    }, [showDepartureBoard, selectedStop, groupedDepartures.length, loadingDeps]);

    return (
        <div className="space-y-4 pt-1">
            {showDepartureBoard && (
                <div className="space-y-4 mb-2">
                    {stopDistanceInfo && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-2xl border border-white/5 text-zinc-400 text-xs">
                            <MapPin size={14} className="text-zinc-500" />
                            <span className="font-medium">{t('map.departures.distance', { distance: stopDistanceInfo.distance, time: stopDistanceInfo.time })}</span>
                        </div>
                    )}
                    <div className="flex items-center justify-between">
                        <span className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">{t('map.departures.upcoming')}</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => selectedStop && toggleFavorite(selectedStop.id)}
                                className={`p-2 rounded-xl border transition-all active:scale-90 ${isFavorite ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-white/5 border-white/5 text-zinc-500 hover:text-zinc-300'}`}
                            >
                                <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
                            </button>
                            <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/5">
                                <button
                                    onClick={() => setDepartureSort('line')}
                                    className={`p-1.5 rounded-lg transition-all ${departureSort === 'line' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    title={t('map.departures.sortByLine')}
                                >
                                    <ArrowDownAz size={14} />
                                </button>
                                <button
                                    onClick={() => setDepartureSort('departure')}
                                    className={`p-1.5 rounded-lg transition-all ${departureSort === 'departure' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    title={t('map.departures.sortByDeparture')}
                                >
                                    <Clock size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <VehicleDetail
                selectedVehicle={selectedVehicle}
                vehicleDetail={vehicleDetail || null}
                loadingDetail={loadingDetail}
                isFollowing={isFollowing}
                onToggleFollow={onToggleFollow}
            />

            {showDepartureBoard && groupedDepartures.map((group, index) => {
                const isExpanded = expandedGroups.includes(group.groupId);
                const visibleDepartures = isExpanded ? group.departures : [group.departures[0]];
                const hasMore = group.departures.length > 1;

                const prevGroup = index > 0 ? groupedDepartures[index - 1] : null;
                const showHeader = !prevGroup || String(prevGroup.line) !== String(group.line) || String(prevGroup.type) !== String(group.type);

                return (
                    <div key={group.groupId} className={showHeader ? "space-y-3" : "space-y-3 -mt-1"}>
                        {showHeader && (
                            <div className="flex items-center gap-3 px-1">
                                <div
                                    className="px-3 py-1 rounded-lg font-bold text-white text-xs shadow-md"
                                    style={{ backgroundColor: getVehicleColor(group.type, group.line) }}
                                >
                                    {group.line}
                                </div>
                                <div className="h-[1px] flex-1 bg-white/10" />
                            </div>
                        )}

                        <div className="space-y-2">
                            {visibleDepartures.map((dep: Departure, idx: number) => (
                                <div
                                    key={idx}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => dep.tripId && onDepartureClick(dep.tripId, dep.vehicleId, dep)}
                                    onKeyDown={(e) => {
                                        if ((e.key === 'Enter' || e.key === ' ') && dep.tripId) {
                                            onDepartureClick(dep.tripId, dep.vehicleId, dep);
                                        }
                                    }}
                                    className={`flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 transition-all
                                        ${dep.tripId ? 'hover:bg-white/10 hover:border-white/20 cursor-pointer active:scale-[0.98]' : ''}
                                    `}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col">
                                            <div className="text-white font-semibold leading-tight">{dep.headsign}</div>
                                            <div className="text-zinc-500 text-[10px] mt-1 flex items-center gap-2">
                                                <span className="tabular-nums">{format(parseISO(dep.scheduled), 'HH:mm', {
                                                    locale: dateLocales[i18n.resolvedLanguage || i18n.language] || enUS
                                                })}</span>
                                                <div className="flex items-center">
                                                    {dep.delay > 30 && (
                                                        <span className="text-rose-400 font-bold tabular-nums">
                                                            {formatDelay(dep.delay)}
                                                        </span>
                                                    )}
                                                    <DelayDelta delta={dep.delayDelta || 0} lastUpdate={dep.lastDelayUpdate} isInline={dep.delay > 30} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col items-end gap-1">
                                        <div className="text-lg font-bold text-emerald-400 tabular-nums">
                                            <Countdown timestamp={dep.timestamp} />
                                        </div>
                                        {stopDistanceInfo && (
                                            <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight
                                                ${getCatchStatus(stopDistanceInfo.distance, dep.timestamp).status === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
                                                    getCatchStatus(stopDistanceInfo.distance, dep.timestamp).status === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                                                        'bg-rose-500/20 text-rose-400'}
                                            `}>
                                                {t(`map.departures.catchStatus.${getCatchStatus(stopDistanceInfo.distance, dep.timestamp).status}`)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {hasMore && (
                                <button
                                    onClick={() => onToggleGroup(group.groupId)}
                                    className="w-full py-2 text-zinc-500 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:text-zinc-400 transition-colors"
                                >
                                    <div className="h-[1px] flex-1 bg-white/5" />
                                    <span>{isExpanded ? t('map.departures.showLess') : t('map.departures.moreConnections', { count: group.departures.length - 1 })}</span>
                                    <div className="h-[1px] flex-1 bg-white/5" />
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}

            {showMetroNightMessage ? (
                <div className="py-12 px-6 flex flex-col items-center text-center space-y-4 bg-white/5 rounded-3xl border border-white/5">
                    <div className="p-4 bg-indigo-500/10 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.1)]">
                        <MoonStar size={32} className="text-indigo-400" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-white font-bold text-lg">{t('map.departures.metroNight.title')}</h3>
                        <p className="text-zinc-400 text-sm leading-relaxed">
                            {t('map.departures.metroNight.description')}
                        </p>
                    </div>
                </div>
            ) : showDepartureBoard && groupedDepartures.length === 0 && !loadingDeps && (
                <div className="py-12 text-center text-zinc-500">{t('map.departures.noUpcoming')}</div>
            )}
        </div>
    );
});

DetailPanelContent.displayName = 'DetailPanelContent';
