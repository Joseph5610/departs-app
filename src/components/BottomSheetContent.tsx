
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownAz, Clock } from 'lucide-react';
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

const dateLocales: Record<string, Locale> = {
    cs: cs,
    en: enUS
};

interface BottomSheetContentProps {
    onToggleFollow: () => void;
}

export const BottomSheetContent = memo<BottomSheetContentProps>(({
    onToggleFollow
}) => {
    const { t, i18n } = useTranslation();
    const { state, actions } = useMap();

    // Data Hooks
    const { data: vehicleDetail, isFetching: loadingDetail } = useVehicleDetail();
    const { isLoading: loadingDeps } = useDepartures();
    const groupedDepartures = useGroupedDepartures();

    const { selectedStop, selectedVehicle, isFollowing, expandedGroups, departureSort } = state;
    const { setDepartureSort, toggleGroup: onToggleGroup, handleDepartureClick: onDepartureClick } = actions;

    const showDepartureBoard = selectedStop && !selectedVehicle;

    return (
        <div className="space-y-4 pt-1">
            {showDepartureBoard && (
                <div className="flex items-center justify-between mb-2">
                    <span className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">{t('map.departures.upcoming')}</span>
                    <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/5">
                        <button
                            onClick={() => setDepartureSort('line')}
                            className={`p-1.5 rounded-lg transition-all ${departureSort === 'line' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                            title="Sort by line"
                        >
                            <ArrowDownAz size={14} />
                        </button>
                        <button
                            onClick={() => setDepartureSort('departure')}
                            className={`p-1.5 rounded-lg transition-all ${departureSort === 'departure' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                            title="Sort by departure time"
                        >
                            <Clock size={14} />
                        </button>
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
                                    onClick={() => dep.tripId && onDepartureClick(dep.tripId, dep.vehicleId, dep)}
                                    className={`flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 transition-all
                                        ${dep.tripId ? 'hover:bg-white/10 hover:border-white/20 cursor-pointer active:scale-[0.98]' : ''}
                                    `}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col">
                                            <div className="text-white font-semibold leading-tight">{dep.headsign}</div>
                                            <div className="text-zinc-500 text-[10px] mt-1 flex items-center gap-2">
                                                <span>{format(parseISO(dep.scheduled), 'HH:mm', {
                                                    locale: dateLocales[i18n.resolvedLanguage || i18n.language] || enUS
                                                })}</span>
                                                {dep.delay > 30 && <span className="text-rose-400">{t('map.departures.delay', { minutes: Math.round(dep.delay / 60) })}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-mono font-bold text-emerald-400">
                                            <Countdown timestamp={dep.timestamp} />
                                        </div>
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

            {showDepartureBoard && groupedDepartures.length === 0 && !loadingDeps && (
                <div className="py-12 text-center text-zinc-500">{t('map.departures.noUpcoming')}</div>
            )}
        </div>
    );
});

BottomSheetContent.displayName = 'BottomSheetContent';
