
import { memo, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownAz, Clock, MoonStar, Star, MapPin, Share2 } from 'lucide-react';
import { type Locale } from 'date-fns';
import { cs } from 'date-fns/locale/cs';
import { enUS } from 'date-fns/locale/en-US';
import { VehicleDetail } from '../VehicleDetail';
import { getVehicleColor } from '../../utils/vehicleColors';
import type { Departure } from '../../types/transit';
import { useMap } from '../../hooks/useMap';
import { useVehicleDetail } from '../../hooks/useVehicleDetail';
import { useGroupedDepartures } from '../../hooks/useGroupedDepartures';
import { useDepartures } from '../../hooks/useDepartures';
import { useInfotexts } from '../../hooks/useInfotexts';
import { METRO_STATIONS } from '../../config/stations';
import { calculateDistance } from '../../utils/transitLogic';
import { DepartureItem } from './DepartureItem';
import { useShare } from '../../hooks/useShare';
import { GenericAlertCard } from '../GenericAlertCard';

const dateLocales: Record<string, Locale> = {
    cs: cs,
    en: enUS
};

interface DetailPanelContentProps {
    onToggleFollow: () => void;
}

export const DetailPanelContent = memo<DetailPanelContentProps>(({
    onToggleFollow
}) => {
    const { t, i18n } = useTranslation();
    const { state, actions } = useMap();
    const { share } = useShare();

    // Data Hooks
    const { data: vehicleDetail, isFetching: loadingDetail } = useVehicleDetail();
    const { isLoading: loadingDeps } = useDepartures();
    const { data: allInfotexts } = useInfotexts();
    const groupedDepartures = useGroupedDepartures();

    const { selectedStop, selectedVehicle, isFollowing, expandedGroups, departureSort, userLocation, userSpeed, favoriteStops } = state;
    const { setDepartureSort, toggleGroup: onToggleGroup, handleDepartureClick: onDepartureClick, toggleFavorite } = actions;

    const showDepartureBoard = selectedStop && !selectedVehicle;
    const isFavorite = selectedStop ? favoriteStops.includes(selectedStop.id) : false;

    const stopDistanceInfo = useMemo(() => {
        if (!selectedStop?.coordinates || !userLocation) return null;
        const distance = calculateDistance(userLocation, selectedStop.coordinates);

        const isAtStop = distance < 20;
        const isMovingFast = userSpeed !== null && userSpeed > 4;

        return {
            distance: Math.round(distance),
            time: Math.ceil(distance / 60), // fallback, actual calculation in getCatchStatus used by DepartureItem
            isAtStop,
            isMovingFast,
            showCatchIndicator: distance < 750 && !isMovingFast
        };
    }, [selectedStop?.coordinates, userLocation, userSpeed]);

    const relevantInfotexts = useMemo(() => {
        if (!showDepartureBoard || !selectedStop || !allInfotexts) return [];

        const stopIds = [selectedStop.id, ...(selectedStop.all_ids || [])];
        return allInfotexts.filter(info =>
            info.relatedStopIds.some(id => stopIds.includes(id))
        );
    }, [showDepartureBoard, selectedStop, allInfotexts]);

    const showMetroNightMessage = useMemo(() => {
        if (!showDepartureBoard || !selectedStop || groupedDepartures.length > 0 || loadingDeps) return false;

        const isMetroStation = !!METRO_STATIONS[selectedStop.name];
        const hour = new Date().getHours();
        const isNightTime = hour >= 0 && hour < 5;

        return isMetroStation && isNightTime;
    }, [showDepartureBoard, selectedStop, groupedDepartures.length, loadingDeps]);

    const locale = dateLocales[i18n.resolvedLanguage || i18n.language] || enUS;

    const handleShare = useCallback(() => {
        if (selectedStop) {
            share({
                title: t('map.departures.shareTitle', { name: selectedStop.name }),
                text: t('map.departures.shareText', { name: selectedStop.name }),
                url: window.location.href
            });
        }
    }, [selectedStop, share, t]);

    return (
        <div className="space-y-4 pt-1">
            {showDepartureBoard && (
                <div className="space-y-4 mb-2">
                    {relevantInfotexts.length > 0 && (
                        <div className="space-y-2">
                            {relevantInfotexts.map(info => (
                                <GenericAlertCard
                                    key={info.id}
                                    title={i18n.resolvedLanguage === 'en' && info.textEn ? info.textEn : info.text}
                                    priority={info.priority}
                                    validFrom={info.valid_from}
                                    validTo={info.valid_to}
                                    isActive={true}
                                />
                            ))}
                        </div>
                    )}

                    {stopDistanceInfo && (stopDistanceInfo.showCatchIndicator || stopDistanceInfo.isAtStop) && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-2xl border border-border text-muted-foreground text-xs">
                            <MapPin size={14} className="text-muted-foreground/60" />
                            <span className="font-medium text-foreground">
                                {stopDistanceInfo.isAtStop
                                    ? t('map.departures.atStop')
                                    : t('map.departures.distance', {
                                        distance: stopDistanceInfo.distance,
                                        time: Math.ceil(stopDistanceInfo.distance / 60) // Simple approximation for header
                                    })}
                            </span>
                        </div>
                    )}
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-[10px] uppercase font-black tracking-widest">{t('map.departures.upcoming')}</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleShare}
                                className="h-8 w-8 flex items-center justify-center rounded-xl border bg-muted/30 border-border text-muted-foreground hover:text-foreground transition-all active:scale-90"
                            >
                                <Share2 size={14} />
                            </button>
                            <button
                                onClick={() => selectedStop && toggleFavorite(selectedStop.id)}
                                className={`h-8 w-8 flex items-center justify-center rounded-xl border transition-all active:scale-90 ${isFavorite ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground'}`}
                            >
                                <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
                            </button>
                            <div className="flex h-8 bg-muted/30 p-0.5 rounded-xl border border-border">
                                <button
                                    onClick={() => setDepartureSort('line')}
                                    className={`px-2 h-full rounded-lg transition-all ${departureSort === 'line' ? 'bg-accent text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                    title={t('map.departures.sortByLine')}
                                >
                                    <ArrowDownAz size={14} />
                                </button>
                                <button
                                    onClick={() => setDepartureSort('departure')}
                                    className={`px-2 h-full rounded-lg transition-all ${departureSort === 'departure' ? 'bg-accent text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
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
                                <div className="h-[1px] flex-1 bg-border" />
                            </div>
                        )}

                        <div className="space-y-2">
                            {visibleDepartures.map((dep: Departure, idx: number) => (
                                <DepartureItem
                                    key={idx}
                                    departure={dep}
                                    onDepartureClick={onDepartureClick}
                                    stopDistanceInfo={stopDistanceInfo}
                                    isTrainStop={selectedStop?.isTrain}
                                    locale={locale}
                                />
                            ))}

                            {hasMore && (
                                <button
                                    onClick={() => onToggleGroup(group.groupId)}
                                    className="w-full py-2 text-muted-foreground text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:text-foreground transition-colors"
                                >
                                    <div className="h-[1px] flex-1 bg-border" />
                                    <span>{isExpanded ? t('map.departures.showLess') : t('map.departures.moreConnections', { count: group.departures.length - 1 })}</span>
                                    <div className="h-[1px] flex-1 bg-border" />
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}

            {showMetroNightMessage ? (
                <div className="py-12 px-6 flex flex-col items-center text-center space-y-4 bg-muted/30 rounded-3xl border border-border">
                    <div className="p-4 bg-indigo-500/10 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.1)]">
                        <MoonStar size={32} className="text-indigo-400" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-foreground font-bold text-lg">{t('map.departures.metroNight.title')}</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            {t('map.departures.metroNight.description')}
                        </p>
                    </div>
                </div>
            ) : showDepartureBoard && groupedDepartures.length === 0 && !loadingDeps && (
                <div className="py-12 text-center text-muted-foreground">{t('map.departures.noUpcoming')}</div>
            )}
        </div>
    );
});

DetailPanelContent.displayName = 'DetailPanelContent';
