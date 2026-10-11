import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Footprints, Star } from 'lucide-react';
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
import { ButtonTooltip } from '@/components/ButtonTooltip';
import { PlatformCircle } from '@/components/PlatformCircle';
import { StopModeIcon } from '@/components/StopModeIcon';
import { RowSeparator } from '@/components/DetailPanel/DepartureBoard/RowSeparator';
import { NextDepartureRow } from '@/components/DetailPanel/DepartureBoard/NextDepartureRow';
import type { StopFeature, Departure, DepartureClickHandler } from '@/types';

interface FavoriteStopSectionProps {
    /** The ids the stop was pinned under, all of which unpinning removes. */
    pinnedIds: string[];
    stopFeature: StopFeature;
    departures: Departure[];
    isError: boolean;
}

/** A pinned stop: its name opens the board, and its next departures follow as board rows. */
export const FavoriteStopSection = ({ pinnedIds, stopFeature, departures, isError }: FavoriteStopSectionProps) => {
    const { t, i18n } = useTranslation();
    const { timezone } = useCityConfig();
    const flyTo = useMapMetadataStore(s => s.actions.flyTo);
    const userLocation = useGeolocationStore(s => s.userLocation);
    const { removeFavoriteStops } = usePreferencesStore(s => s.actions);
    const selectedCity = usePreferencesStore(s => s.selectedCity);

    const { stop_id, stop_name, platform_code } = stopFeature.properties;
    const coordinates = stopFeature.geometry.coordinates as [number, number];
    const distance = useMemo(() => getStopDistanceInfo(userLocation, coordinates), [userLocation, coordinates]);
    const next = useMemo(() => nextDepartures(departures, DEPARTURES_CONFIG.FAVORITE_CARD_COUNT), [departures]);

    const openBoard = () => {
        flyTo({ center: coordinates, zoom: MAP_CAMERA.STOP_SELECT_ZOOM, duration: MAP_CAMERA.FLY_MS });
        navigate(paths.stop(selectedCity, stop_id));
    };
    const openTrip = useCallback<DepartureClickHandler>(
        (tripId, vehicleId) => navigate(paths.trip(selectedCity, tripId, vehicleId)),
        [selectedCity],
    );

    const status = isError ? t('errors.generic') : next.length === 0 ? t('map.departures.noUpcoming') : null;

    return (
        <section className="flex flex-col gap-1 py-2.5">
            <div className="relative">
                {/* The card's header: the stop's mode and platform, its name and distance; it opens the stop's board. */}
                <Button
                    variant="ghost"
                    onClick={openBoard}
                    className="h-auto w-full justify-start gap-3 whitespace-normal rounded-xl py-2 pl-2 pr-11 text-left font-normal hover:bg-foreground/5"
                >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
                        <StopModeIcon lines={stopFeature.properties.lines} />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex min-w-0 items-center gap-1.5">
                            {platform_code && <PlatformCircle code={platform_code} />}
                            <span className="truncate text-base font-bold leading-tight tracking-tight text-foreground">{stop_name}</span>
                            <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                        </span>
                        {distance && (
                            <span className={cn("flex items-center gap-1 text-xs", distance.isAtStop ? "font-semibold text-primary" : "text-muted-foreground")}>
                                <Footprints size={12} strokeWidth={1.75} aria-hidden="true" />
                                {formatStopDistance(distance, t, i18n.language)}
                            </span>
                        )}
                    </span>
                </Button>
                <span className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center">
                    <ButtonTooltip label={t('map.departures.removeFromFavorites')}>
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => removeFavoriteStops(pinnedIds)}
                        aria-label={t('map.departures.removeFromFavorites')}
                        className="text-favorite hover:text-favorite-hover focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                        <Star size={16} fill="currentColor" strokeWidth={1.5} />
                    </Button>
                    </ButtonTooltip>
                </span>
            </div>
            <RowSeparator inset={false} className="my-1" />

            {status ? (
                <span className={cn("py-2 pl-[calc(var(--badge-col)+1rem)] text-xs", isError ? "text-destructive" : "text-muted-foreground")}>{status}</span>
            ) : next.map(dep => (
                <NextDepartureRow
                    key={departureKey(dep)}
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
            ))}
        </section>
    );
};
