import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { navigate } from '@/lib/history';
import { paths } from '@/lib/routes';
import { usePreferencesStore } from '@/state/preferencesStore';
import type { FavoriteLine, StopFeature, Departure } from '@/types';
import { nextDeparturesOf } from '@/domain/departures';
import { useSelectionStore } from '@/state/selectionStore';
import { useMapMetadataStore } from '@/state/mapMetadataStore';
import { DEPARTURES_CONFIG, FALLBACK_ROUTE_COLOR, MAP_CAMERA } from '@/config/constants';
import { LineBadge } from '@/components/LineBadge';
import { CardTitle } from '@/components/ui/card';
import { FavoriteCard } from './FavoriteCard';
import { FavoriteDepartureRow } from './FavoriteDepartureRow';
import { useCityConfig } from '@/hooks/data/useCities';

/** A pinned line and direction at one stop with its next departures; opens the stop's board filtered to the line. */
export const FavoriteLineCard = ({ favorite, stopFeature, departures, isLoading }: {
    favorite: FavoriteLine;
    stopFeature: StopFeature | undefined;
    departures: Departure[];
    isLoading: boolean;
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

    const routeColor = next[0]?.route_color || FALLBACK_ROUTE_COLOR;
    const stopName = stopFeature?.properties.stop_name ?? '';

    const open = () => {
        if (stopFeature) {
            flyTo({ center: stopFeature.geometry.coordinates as [number, number], zoom: MAP_CAMERA.STOP_SELECT_ZOOM, duration: MAP_CAMERA.FLY_MS });
        }
        presetLineFilter(favorite.line);
        navigate(paths.stop(favorite.city, favorite.stopId));
    };

    return (
        <FavoriteCard
            onOpen={open}
            onUnpin={() => toggleFavoriteLine(favorite)}
            unpinLabel={t('favorites.unpinLine', { line: favorite.line, headsign: favorite.headsign })}
            header={<>
                <LineBadge name={favorite.line} routeColor={routeColor} size="lg" className="shadow-sm" />
                <ArrowRight size={14} strokeWidth={1.5} className="text-muted-foreground opacity-40 shrink-0" />
                <div className="min-w-0 flex-1">
                    <CardTitle className="text-sm font-semibold leading-tight truncate">{favorite.headsign}</CardTitle>
                    {stopName && <div className="text-xs font-medium text-foreground/60 mt-0.5 truncate">{t('favorites.fromStop', { stop: stopName })}</div>}
                </div>
            </>}
        >
                {next.length > 0 ? (
                    <div className="flex flex-col divide-y divide-black/5 dark:divide-white/5">
                        {next.map((dep, idx) => (
                            <FavoriteDepartureRow key={dep.tripId ? `${dep.tripId}-${dep.scheduled}` : idx} dep={dep} timeZone={timezone} isOdd={idx % 2 === 1} />
                        ))}
                    </div>
                ) : !isLoading && (
                    <div className="text-xs text-muted-foreground py-4 text-center">{t('map.departures.noUpcoming')}</div>
                )}
        </FavoriteCard>
    );
};
