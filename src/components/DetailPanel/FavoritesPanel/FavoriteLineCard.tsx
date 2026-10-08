import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { navigate } from '@/lib/history';
import { paths } from '@/lib/routes';
import { usePreferencesStore } from '@/state/preferencesStore';
import type { FavoriteLine, StopFeature, Departure } from '@/types';
import { nextDeparturesOf } from '@/domain/departures';
import { lineColorAt } from '@/domain/stops';
import { useSelectionStore } from '@/state/selectionStore';
import { useMapMetadataStore } from '@/state/mapMetadataStore';
import { DEPARTURES_CONFIG, FALLBACK_ROUTE_COLOR, MAP_CAMERA } from '@/config/constants';
import { LineBadge } from '@/components/LineBadge';
import { safeHexColor } from '@/lib/color';
import { CardTitle } from '@/components/ui/card';
import { FavoriteCard, type FavoriteDragHandle } from './FavoriteCard';
import { DepartureList } from '@/components/DetailPanel/DepartureBoard/DepartureList';
import { DepartureItem } from '@/components/DetailPanel/DepartureBoard/DepartureItem';
import { useCityConfig } from '@/hooks/data/useCities';

/** A pinned line and direction at one stop with its next departures; opens the stop's board filtered to the line. */
export const FavoriteLineCard = ({ favorite, stopFeature, departures, isLoading, dragHandle }: {
    favorite: FavoriteLine;
    stopFeature: StopFeature | undefined;
    departures: Departure[];
    isLoading: boolean;
    dragHandle?: FavoriteDragHandle;
}) => {
    const { t } = useTranslation();
    const { timezone } = useCityConfig();
    const { toggleFavoriteLine } = usePreferencesStore(s => s.actions);
    const { presetLineFilter } = useSelectionStore(s => s.actions);
    const flyTo = useMapMetadataStore(s => s.actions.flyTo);

    const next = useMemo(
        () => nextDeparturesOf(departures, favorite.line, favorite.headsign, DEPARTURES_CONFIG.FAVORITE_CARD_COUNT),
        [departures, favorite.line, favorite.headsign],
    );

    const routeColor = safeHexColor(next[0]?.route_color || lineColorAt(stopFeature, favorite.line));
    const stopName = stopFeature?.properties.stop_name ?? '';

    const open = () => {
        if (stopFeature) {
            flyTo({ center: stopFeature.geometry.coordinates as [number, number], zoom: MAP_CAMERA.STOP_SELECT_ZOOM, duration: MAP_CAMERA.FLY_MS });
        }
        presetLineFilter(favorite.line);
        navigate(paths.stop(favorite.city, favorite.stopId));
    };

    const openTrip = useCallback(
        (tripId: string, vehicleId?: string) => navigate(paths.trip(favorite.city, tripId, vehicleId)),
        [favorite.city],
    );

    return (
        <FavoriteCard
            onOpen={open}
            dragHandle={dragHandle}
            onUnpin={() => toggleFavoriteLine(favorite)}
            unpinLabel={t('favorites.unpinLine', { line: favorite.line, headsign: favorite.headsign })}
            routeColor={routeColor}
            header={<>
                <LineBadge name={favorite.line} routeColor={routeColor || FALLBACK_ROUTE_COLOR} size="lg" className="shadow-sm" />
                <ArrowRight size={14} strokeWidth={1.5} className="size-3.5 text-muted-foreground opacity-40 shrink-0" />
                <div className="min-w-0 flex-1">
                    <CardTitle className="text-sm font-semibold leading-tight truncate">{favorite.headsign}</CardTitle>
                    {stopName && <div className="text-xs font-medium text-foreground/60 mt-0.5 truncate">{t('favorites.fromStop', { stop: stopName })}</div>}
                </div>
            </>}
        >
                {next.length > 0 ? (
                    <DepartureList departures={next}>
                        {(dep) => <DepartureItem departure={dep} timeZone={timezone} onDepartureClick={openTrip} hideHeadsign />}
                    </DepartureList>
                ) : !isLoading && (
                    <div className="text-xs text-muted-foreground py-4 text-center">{t('map.departures.noUpcoming')}</div>
                )}
        </FavoriteCard>
    );
};
