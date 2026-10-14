import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { navigate } from '@/lib/history';
import { paths } from '@/lib/routes';
import { safeHexColor } from '@/lib/color';
import { nextDeparturesOf } from '@/domain/departures';
import { lineColorAt } from '@/domain/stops';
import { useSelectionStore } from '@/state/selectionStore';
import { useMapMetadataStore } from '@/state/mapMetadataStore';
import { useCityConfig } from '@/hooks/data/useCities';
import { usePinLine } from '@/hooks/features/usePinLine';
import { DEPARTURES_CONFIG, FALLBACK_ROUTE_COLOR, MAP_CAMERA } from '@/config/constants';
import { Button } from '@/components/ui/button';
import { LineBadge } from '@/components/LineBadge';
import { DirectionRow } from '@/components/DetailPanel/DepartureBoard/DirectionRow';
import { RowSeparator } from '@/components/DetailPanel/DepartureBoard/RowSeparator';
import { BoardRow, BoardSection, RowHeadsign, RowTimeLine } from '@/components/DetailPanel/DepartureBoard/BoardRow';
import type { FavoriteLine, StopFeature, Departure, DepartureClickHandler } from '@/types';

interface FavoriteLineRowProps {
    favorite: FavoriteLine;
    stopFeature: StopFeature | undefined;
    departures: Departure[];
    isFirst: boolean;
}

/** A pinned line and direction at one stop, laid out like its row on the stop's board, with a way to that board. */
export const FavoriteLineRow = ({ favorite, stopFeature, departures, isFirst }: FavoriteLineRowProps) => {
    const { t } = useTranslation();
    const { timezone } = useCityConfig();
    const { presetLineFilter } = useSelectionStore(s => s.actions);
    const flyTo = useMapMetadataStore(s => s.actions.flyTo);
    const pin = usePinLine(favorite.stopId, favorite.line, favorite.headsign);

    const next = useMemo(
        () => nextDeparturesOf(departures, favorite.line, favorite.headsign, DEPARTURES_CONFIG.VISIBLE_PER_GROUP),
        [departures, favorite.line, favorite.headsign],
    );
    const routeColor = safeHexColor(next[0]?.route_color || lineColorAt(stopFeature, favorite.line)) || FALLBACK_ROUTE_COLOR;
    const stopName = stopFeature?.properties.stop_name;

    const openBoard = () => {
        if (stopFeature) flyTo({ center: stopFeature.geometry.coordinates as [number, number], zoom: MAP_CAMERA.STOP_SELECT_ZOOM, duration: MAP_CAMERA.FLY_MS });
        presetLineFilter(favorite.line);
        navigate(paths.stop(favorite.city, favorite.stopId));
    };
    const openTrip = useCallback<DepartureClickHandler>(
        (tripId, vehicleId) => navigate(paths.trip(favorite.city, tripId, vehicleId)),
        [favorite.city],
    );

    const boardLink = stopName && (
        <Button
            variant="ghost"
            onClick={openBoard}
            aria-label={t('favorites.openBoard')}
            className="h-auto w-fit max-w-full justify-start gap-0.5 rounded-md p-0 text-xs font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
            <span className="truncate">{t('favorites.fromStop', { stop: stopName })}</span>
            <ChevronRight size={14} strokeWidth={1.75} className="shrink-0" />
        </Button>
    );

    if (next.length === 0) {
        return (
            <>
            {!isFirst && <RowSeparator />}
            <BoardSection>
                <BoardRow action={{ onTrigger: pin.toggle, isActive: pin.isPinned, label: pin.label }} below={boardLink}>
                    <LineBadge name={favorite.line} routeColor={routeColor} size="lg" className="justify-self-center" />
                    <RowHeadsign headsign={favorite.headsign} isPinned={pin.isPinned} />
                    <RowTimeLine>{t('map.departures.noUpcoming')}</RowTimeLine>
                </BoardRow>
            </BoardSection>
            </>
        );
    }

    return (
        <DirectionRow
            groupId={`${favorite.stopId}|${favorite.line}|${favorite.headsign}`}
            line={favorite.line}
            headsign={favorite.headsign}
            departures={next}
            routeColor={routeColor}
            startsLine={true}
            isFirst={isFirst}
            isExpanded={false}
            isFiltered={false}
            boardStopId={favorite.stopId}
            timeZone={timezone}
            highlightedTripId={null}
            onDepartureClick={openTrip}
            note={boardLink}
        />
    );
};

