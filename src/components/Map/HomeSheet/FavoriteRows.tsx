import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import { nextDepartures, nextDeparturesOf } from '@/domain/departures';
import { lineColorAt } from '@/domain/stops';
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Skeleton } from '@/components/ui/skeleton';
import { LineBadge } from '@/components/LineBadge';
import { MinutesUntil } from '@/components/MinutesUntil';
import { DEPARTURES_CONFIG, FALLBACK_ROUTE_COLOR } from '@/config/constants';
import type { BoardStop, Departure, FavoriteLine } from '@/types';
import { RowChevron } from '@/components/Chevron';
import { useOpenStop } from '@/hooks/features/useOpenStop';

/** Lead column of a favourite row, as wide as a line badge so names line up under each other. */
const LEAD = 'w-9 shrink-0 justify-center';

/** A stop's next departures while they load: badge and minutes, as many as the row shows. */
const DeparturesSkeleton = () => (
    <span className="flex h-5 items-center gap-3">
        {Array.from({ length: DEPARTURES_CONFIG.FAVORITE_STOP_ROW_COUNT }, (_, i) => (
            <span key={i} className="flex items-center gap-1.5">
                <Skeleton className="h-4.5 w-6 rounded-badge" />
                <Skeleton className="h-3 w-9" />
            </span>
        ))}
    </span>
);

const NoDepartures = () => {
    const { t } = useTranslation();
    return <span className="type-meta text-muted-foreground">{t('map.departures.noUpcoming')}</span>;
};

interface FavoriteStopRowProps {
    stop: BoardStop;
    departures: Departure[];
    isLoading: boolean;
}

/** A pinned stop on the home sheet: its name and next departures in one line; opens its board. */
export const FavoriteStopRow = ({ stop, departures, isLoading }: FavoriteStopRowProps) => {
    const openStop = useOpenStop();
    const next = useMemo(() => nextDepartures(departures, DEPARTURES_CONFIG.FAVORITE_STOP_ROW_COUNT, true), [departures]);

    const open = () => openStop(stop.id, { pos: stop.pos });

    return (
        <Item className="[--row-sep:3.875rem]" render={<button type="button" onClick={open} data-testid={`favorite-mini-stop-${stop.id}`} />}>
            <ItemMedia className={LEAD}>
                <span className="grid size-8 place-items-center rounded-full bg-fill-2 text-favorite"><Star size={16} strokeWidth={1.75} fill="currentColor" /></span>
            </ItemMedia>
            <ItemContent className="min-w-0 gap-1">
                <ItemTitle className="w-full type-headsign text-foreground"><span className="truncate">{stop.name}</span></ItemTitle>
                {next.length === 0 ? (isLoading ? <DeparturesSkeleton /> : <NoDepartures />) : (
                    <span className="flex min-w-0 items-center gap-3 overflow-hidden">
                        {next.map(dep => (
                            <span key={`${dep.tripId}-${dep.timestamp}`} className="flex shrink-0 items-center gap-1.5">
                                <LineBadge name={String(dep.line)} routeColor={dep.route_color || FALLBACK_ROUTE_COLOR} size="row" />
                                <span className="type-group tabular-nums"><MinutesUntil timestamp={dep.timestamp} /></span>
                            </span>
                        ))}
                    </span>
                )}
            </ItemContent>
            <ItemActions><RowChevron /></ItemActions>
        </Item>
    );
};

interface FavoriteLineRowProps {
    favorite: FavoriteLine;
    stop: BoardStop | undefined;
    departures: Departure[];
    isLoading: boolean;
}

/** A pinned line and direction on the home sheet: where it goes and from where, its next departure and the one after; opens the stop's board filtered to the line. */
export const FavoriteLineRow = ({ favorite, stop, departures, isLoading }: FavoriteLineRowProps) => {
    const { t } = useTranslation();
    const openStop = useOpenStop();
    const next = useMemo(
        () => nextDeparturesOf(departures, favorite.line, favorite.headsign, DEPARTURES_CONFIG.FAVORITE_CARD_COUNT),
        [departures, favorite.line, favorite.headsign],
    );
    const routeColor = next[0]?.route_color || lineColorAt(stop, favorite.line) || FALLBACK_ROUTE_COLOR;

    const open = () => openStop(favorite.stopId, { pos: stop?.pos, city: favorite.city, line: favorite.line });

    return (
        <Item className="[--row-sep:3.875rem]" render={<button type="button" onClick={open} data-testid={`favorite-mini-line-${favorite.stopId}-${favorite.line}`} />}>
            <ItemMedia className={LEAD}>
                <LineBadge name={favorite.line} routeColor={routeColor} size="lg" />
            </ItemMedia>
            <ItemContent className="min-w-0 gap-0.5">
                <ItemTitle className="w-full type-headsign text-foreground"><span className="truncate">{favorite.headsign}</span></ItemTitle>
                {stop && <span className="truncate type-meta text-muted-foreground">{t('favorites.fromStop', { stop: stop.name })}</span>}
            </ItemContent>
            <ItemActions className="shrink-0 flex-col items-end gap-0.5">
                {next[0] ? (
                    <>
                        <span className="type-headsign tabular-nums"><MinutesUntil timestamp={next[0].timestamp} /></span>
                        {next[1] && (
                            <span className="type-meta tabular-nums text-muted-foreground">
                                {t('home.then')} <MinutesUntil timestamp={next[1].timestamp} tone="muted" />
                            </span>
                        )}
                    </>
                ) : isLoading ? (
                    <>
                        <span className="flex h-5 items-center"><Skeleton className="h-4 w-12" /></span>
                        <span className="flex h-4.5 items-center"><Skeleton className="h-3 w-16" /></span>
                    </>
                ) : <span className="type-headsign text-label-3" aria-label={t('map.departures.noUpcoming')}>–</span>}
            </ItemActions>
        </Item>
    );
};
