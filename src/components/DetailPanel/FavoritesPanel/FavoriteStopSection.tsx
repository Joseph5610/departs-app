import { Fragment, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Footprints, Star } from 'lucide-react';
import { cn } from '@/lib/cn';
import { navigate } from '@/lib/history';
import { paths } from '@/lib/routes';
import { safeHexColor } from '@/lib/color';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useMapMetadataStore } from '@/state/mapMetadataStore';
import { useGeolocationStore } from '@/state/geolocationStore';
import { formatStopDistance } from '@/hooks/derived/useStopDistance';
import { useCityConfig } from '@/hooks/data/useCities';
import { getStopDistanceInfo } from '@/domain/stops';
import { boardingPlace, departureKey, nextDepartures } from '@/domain/departures';
import { DEPARTURES_CONFIG, FALLBACK_ROUTE_COLOR, MAP_CAMERA } from '@/config/constants';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionTitle } from '@/components/SectionTitle';
import { ButtonTooltip } from '@/components/ButtonTooltip';
import { RowSeparator } from '@/components/DetailPanel/DepartureBoard/RowSeparator';
import { NextDepartureRow } from '@/components/DetailPanel/DepartureBoard/NextDepartureRow';
import { BoardRow, RowTimeLine } from '@/components/DetailPanel/DepartureBoard/BoardRow';
import { StopLead } from './StopLead';
import type { BoardStop, Departure, DepartureClickHandler, FavoriteStop } from '@/types';

interface FavoriteStopSectionProps {
    /** The pins that open this stop, all of which unpinning removes. */
    pins: FavoriteStop[];
    stop: BoardStop;
    departures: Departure[];
    isError: boolean;
}

/** A pinned stop: its name opens the board, and its next departures follow as board rows. */
export const FavoriteStopSection = ({ pins, stop, departures, isError }: FavoriteStopSectionProps) => {
    const { t, i18n } = useTranslation();
    const { timezone } = useCityConfig();
    const flyTo = useMapMetadataStore(s => s.actions.flyTo);
    const userLocation = useGeolocationStore(s => s.userLocation);
    const { removeFavoriteStops } = usePreferencesStore(s => s.actions);
    const selectedCity = usePreferencesStore(s => s.selectedCity);

    const distance = useMemo(() => getStopDistanceInfo(userLocation, stop.pos), [userLocation, stop.pos]);
    const next = useMemo(() => nextDepartures(departures, DEPARTURES_CONFIG.FAVORITE_CARD_COUNT), [departures]);

    const openBoard = () => {
        flyTo({ center: stop.pos, zoom: MAP_CAMERA.STOP_SELECT_ZOOM, duration: MAP_CAMERA.FLY_MS });
        navigate(paths.stop(selectedCity, stop.id));
    };
    const openTrip = useCallback<DepartureClickHandler>(
        (tripId, vehicleId) => navigate(paths.trip(selectedCity, tripId, vehicleId)),
        [selectedCity],
    );

    const status = isError ? t('errors.generic') : next.length === 0 ? t('map.departures.noUpcoming') : null;

    return (
        <section className="flex flex-col gap-2">
            <div className="flex min-h-7 items-center gap-2">
                <div className="min-w-0 flex-1">
                    <SectionTitle onOpen={openBoard} lead={<StopLead stop={stop} />}>{stop.name}</SectionTitle>
                </div>
                {distance && (
                    <span className={cn("flex shrink-0 items-center gap-1 type-meta", distance.isAtStop ? "font-semibold text-tint-mint" : "text-muted-foreground")}>
                        <Footprints size={13} strokeWidth={1.75} aria-hidden="true" />
                        {formatStopDistance(distance, t, i18n.language)}
                    </span>
                )}
                <ButtonTooltip label={t('map.departures.removeFromFavorites')}>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeFavoriteStops(pins)}
                    aria-label={t('map.departures.removeFromFavorites')}
                    className="-mr-2 text-favorite hover:text-favorite-hover focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                    <Star size={17} fill="currentColor" strokeWidth={1.75} />
                </Button>
                </ButtonTooltip>
            </div>

            <Card size="none" className="px-3.5">
                {status ? (
                    <BoardRow>
                        <RowTimeLine className={cn("row-start-1 mt-0", isError && "text-destructive")}>{status}</RowTimeLine>
                    </BoardRow>
                ) : next.map((dep, idx) => (
                    <Fragment key={departureKey(dep)}>
                        {idx > 0 && <RowSeparator />}
                        <NextDepartureRow
                            departure={dep}
                            line={String(dep.line)}
                            headsign={dep.headsign}
                            routeColor={safeHexColor(dep.route_color) || FALLBACK_ROUTE_COLOR}
                            {...boardingPlace(dep)}
                            timeZone={timezone}
                            isHighlighted={false}
                            onDepartureClick={openTrip}
                            testId={`favorite-departure-${dep.tripId}`}
                        />
                    </Fragment>
                ))}
            </Card>
        </section>
    );
};
