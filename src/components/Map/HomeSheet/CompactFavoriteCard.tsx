import type React from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import { navigate } from '@/lib/history';
import { paths } from '@/lib/routes';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useMapMetadataStore } from '@/state/mapMetadataStore';
import { useSelectionStore } from '@/state/selectionStore';
import { nextDepartures, nextDeparturesOf } from '@/domain/departures';
import { lineColorAt } from '@/domain/stops';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LineBadge } from '@/components/LineBadge';
import { DEPARTURES_CONFIG, FALLBACK_ROUTE_COLOR, MAP_CAMERA } from '@/config/constants';
import type { Departure, FavoriteLine, StopFeature } from '@/types';
import { MinutesUntil } from '@/components/MinutesUntil';

interface CardShellProps {
    onOpen: () => void;
    testId: string;
    children: React.ReactNode;
}

/** The tappable frame every favourite on the home sheet shares. */
const CardShell = ({ onOpen, testId, children }: CardShellProps) => (
    <button
        type="button"
        onClick={onOpen}
        className="w-[14.5rem] shrink-0 snap-start rounded-2xl text-left outline-none transition-transform active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring/50"
        data-testid={testId}
    >
        <Card variant="inset" size="none" className="h-full gap-3 p-3.5">{children}</Card>
    </button>
);

const RowsPlaceholder = () => (
    <div className="flex flex-col gap-2" aria-hidden="true">
        {[0, 1].map(i => (
            <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-4 w-7 rounded" />
                <Skeleton className="h-3.5 flex-1" />
                <Skeleton className="h-3.5 w-10" />
            </div>
        ))}
    </div>
);

const NoDepartures = () => {
    const { t } = useTranslation();
    return <div className="mt-auto text-xs text-muted-foreground">{t('map.departures.noUpcoming')}</div>;
};

interface CompactStopCardProps {
    stopFeature: StopFeature;
    departures: Departure[];
    isLoading: boolean;
}

/** A pinned stop on the home sheet: its name and next two departures; opens its board. */
export const CompactStopCard = ({ stopFeature, departures, isLoading }: CompactStopCardProps) => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const flyTo = useMapMetadataStore(s => s.actions.flyTo);
    const next = useMemo(() => nextDepartures(departures, DEPARTURES_CONFIG.FAVORITE_CARD_COUNT, true), [departures]);
    const { stop_id, stop_name } = stopFeature.properties;

    const open = () => {
        flyTo({ center: stopFeature.geometry.coordinates as [number, number], zoom: MAP_CAMERA.STOP_SELECT_ZOOM, duration: MAP_CAMERA.FLY_MS });
        navigate(paths.stop(selectedCity, stop_id));
    };

    return (
        <CardShell onOpen={open} testId={`favorite-mini-stop-${stop_id}`}>
            <div className="flex min-w-0 items-center gap-1.5">
                <Star size={14} strokeWidth={1.5} className="shrink-0 fill-favorite text-favorite" />
                <span className="truncate text-title font-semibold text-foreground">{stop_name}</span>
            </div>
            {next.length === 0 ? (isLoading ? <RowsPlaceholder /> : <NoDepartures />) : (
                <div className="mt-auto flex flex-col gap-2">
                    {next.map(dep => (
                        <div key={`${dep.tripId}-${dep.timestamp}`} className="flex min-w-0 items-center gap-2">
                            <LineBadge name={String(dep.line)} routeColor={dep.route_color || FALLBACK_ROUTE_COLOR} size="sm" />
                            <span className="min-w-0 flex-1 truncate text-body-sm text-muted-foreground">{dep.headsign}</span>
                            <span className="shrink-0 text-body-sm font-semibold tabular-nums text-foreground"><MinutesUntil timestamp={dep.timestamp} /></span>
                        </div>
                    ))}
                </div>
            )}
        </CardShell>
    );
};

interface CompactLineCardProps {
    favorite: FavoriteLine;
    stopFeature: StopFeature | undefined;
    departures: Departure[];
    isLoading: boolean;
}

/** A pinned line and direction on the home sheet: when it next leaves its stop; opens the stop's board filtered to the line. */
export const CompactLineCard = ({ favorite, stopFeature, departures, isLoading }: CompactLineCardProps) => {
    const { t } = useTranslation();
    const { presetLineFilter } = useSelectionStore(s => s.actions);
    const flyTo = useMapMetadataStore(s => s.actions.flyTo);
    const next = useMemo(
        () => nextDeparturesOf(departures, favorite.line, favorite.headsign, DEPARTURES_CONFIG.FAVORITE_CARD_COUNT),
        [departures, favorite.line, favorite.headsign],
    );
    const routeColor = next[0]?.route_color || lineColorAt(stopFeature, favorite.line) || FALLBACK_ROUTE_COLOR;
    const stopName = stopFeature?.properties.stop_name;

    const open = () => {
        if (stopFeature) flyTo({ center: stopFeature.geometry.coordinates as [number, number], zoom: MAP_CAMERA.STOP_SELECT_ZOOM, duration: MAP_CAMERA.FLY_MS });
        presetLineFilter(favorite.line);
        navigate(paths.stop(favorite.city, favorite.stopId));
    };

    return (
        <CardShell onOpen={open} testId={`favorite-mini-line-${favorite.stopId}-${favorite.line}`}>
            <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                    <LineBadge name={favorite.line} routeColor={routeColor} size="md" />
                    <span className="truncate text-title font-semibold text-foreground">{favorite.headsign}</span>
                </div>
                {stopName && <div className="mt-1 truncate text-xs text-muted-foreground">{t('favorites.fromStop', { stop: stopName })}</div>}
            </div>
            {next.length === 0 ? (isLoading ? <Skeleton className="mt-auto h-6 w-24" /> : <NoDepartures />) : (
                <div className="mt-auto flex items-baseline gap-2">
                    <span className="text-xl font-bold leading-none tabular-nums text-foreground"><MinutesUntil timestamp={next[0].timestamp} /></span>
                    {next[1] && (
                        <span className="truncate text-xs text-muted-foreground">
                            {t('home.then')} <MinutesUntil timestamp={next[1].timestamp} />
                        </span>
                    )}
                </div>
            )}
        </CardShell>
    );
};
