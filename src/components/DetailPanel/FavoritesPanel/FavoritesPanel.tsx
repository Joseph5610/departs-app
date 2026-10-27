import { cn } from '@/lib/cn';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Reorder } from 'framer-motion';
import { Star } from 'lucide-react';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useFavorites } from '@/hooks/derived/useFavorites';
import { useFavoriteDepartures } from '@/hooks/data/useFavoriteDepartures';
import { moveShown, nextDepartures } from '@/domain/departures';
import { DEPARTURES_CONFIG, FALLBACK_ROUTE_COLOR } from '@/config/constants';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LineBadge } from '@/components/LineBadge';

import { badgeColumnStyle } from '@/lib/lineBadge';
import { safeHexColor } from '@/lib/color';
import { lineColorAt } from '@/domain/stops';
import { FavoriteStopSection } from './FavoriteStopSection';
import { FavoriteLineRow } from './FavoriteLineRow';
import { FavoritesSkeleton } from './FavoritesSkeleton';
import { SortableFavorite } from './SortableFavorite';
import { FavoriteReorderRow } from './FavoriteReorderRow';
import { StopLead } from './StopLead';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import type { TFunction } from 'i18next';
import type { BoardStop, FavoriteLine, PinnedStop } from '@/types';

export const FavoritesPanel = () => {
    const { t } = useTranslation();

    const { allLines: favoriteLines, allStops: favoriteStops, lines, stops, lineStops, isLoading: stopsLoading, pinnedStopCount, hasTabs, tab } = useFavorites();
    const { reorderFavoriteLines, reorderFavoriteStops } = usePreferencesStore(s => s.actions);

    const stopIds = useMemo(() => {
        const ids = new Set(favoriteStops.map(pin => pin.stop.id));
        for (const fav of favoriteLines) ids.add(fav.stopId);
        return [...ids];
    }, [favoriteStops, favoriteLines]);

    const { departuresByStop, isLoading: departuresLoading, isError } = useFavoriteDepartures(stopIds);

    const reorderStops = useCallback(
        (pinned: PinnedStop[]) => reorderFavoriteStops(pinned.map(p => p.pin)),
        [reorderFavoriteStops]
    );
    const moveLine = useCallback(
        (fav: FavoriteLine, delta: number) => reorderFavoriteLines([...moveShown(favoriteLines, fav, delta)]),
        [favoriteLines, reorderFavoriteLines]
    );
    const moveStop = useCallback(
        (pin: PinnedStop, delta: number) => reorderStops([...moveShown(favoriteStops, pin, delta)]),
        [favoriteStops, reorderStops]
    );

    const [isReordering, setIsReordering] = useState(false);
    // Each list shares one badge column, as wide as its widest badge, like the rows of a board.
    const lineBadgeColumn = useMemo(() => badgeColumnStyle(lines.map(fav => fav.line)), [lines]);
    const stopBadgeColumn = useMemo(() => badgeColumnStyle(stops.flatMap(pin =>
        nextDepartures(departuresByStop.get(pin.stop.id) ?? [], DEPARTURES_CONFIG.FAVORITE_CARD_COUNT).map(dep => String(dep.line))
    )), [stops, departuresByStop]);
    const canReorder = lines.length > 1 || stops.length > 1;
    const isLoading = stopsLoading || departuresLoading;
    const showsStops = hasTabs ? tab === 'stops' : favoriteLines.length === 0;

    // Pinned stops resolve with the stop list, so they count as pinned until it has loaded.
    if (favoriteLines.length === 0 && (pinnedStopCount === 0 || (!isLoading && favoriteStops.length === 0))) {
        return (
            <Empty className="py-16 animate-in fade-in duration-500">
                <EmptyHeader>
                    <EmptyMedia
                        variant="icon"
                        className="size-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary shadow-[0_0_20px_rgba(var(--color-primary),0.1)] [&_svg:not([class*='size-'])]:size-7"
                    >
                        <Star strokeWidth={1.5} />
                    </EmptyMedia>
                    <EmptyTitle className="text-base font-bold text-foreground/90">
                        {t('favorites.empty')}
                    </EmptyTitle>
                    <EmptyDescription className="text-body-sm max-w-64 text-balance">
                        {t('favorites.emptySub')}
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <div className="flex flex-col">
            {canReorder && (
                <div className="flex justify-end pb-1 pr-4">
                    <Button
                        variant="link"
                        size="sm"
                        onClick={() => setIsReordering(on => !on)}
                        disabled={isLoading}
                        data-testid="favorites-reorder-toggle"
                        className="px-0"
                    >
                        {isReordering ? t('favorites.reorderDone') : t('favorites.reorderStart')}
                    </Button>
                </div>
            )}
            {isLoading ? (
                <FavoritesSkeleton kind={showsStops ? 'stops' : 'lines'} count={hasTabs ? lines.length + stops.length : pinnedStopCount + favoriteLines.length} />
            ) : (
                <>
                {lines.length > 0 && (
                    <Card size="none" variant="inset" className="px-2" style={lineBadgeColumn}>
                        <Reorder.Group as="div" axis="y" values={lines} onReorder={reorderFavoriteLines} className="flex flex-col">
                            {lines.map((fav, idx) => (
                                <SortableFavorite key={`${fav.stopId}|${fav.line}|${fav.headsign}`} value={fav} sortable={isReordering && lines.length > 1} onMove={moveLine}>
                                    {(handle) => isReordering ? (
                                        <FavoriteReorderRow
                                            lead={<LineBadge name={fav.line} routeColor={safeHexColor(lineColorAt(lineStops.get(fav.stopId), fav.line)) || FALLBACK_ROUTE_COLOR} size="lg" />}
                                            title={fav.headsign}
                                            subtitle={stopName(lineStops.get(fav.stopId), t)}
                                            isFirst={idx === 0}
                                            dragHandle={handle}
                                        />
                                    ) : (
                                        <FavoriteLineRow
                                            favorite={fav}
                                            stop={lineStops.get(fav.stopId)}
                                            departures={departuresByStop.get(fav.stopId) ?? []}
                                            isFirst={idx === 0}
                                        />
                                    )}
                                </SortableFavorite>
                            ))}
                        </Reorder.Group>
                    </Card>
                )}
                {stops.length > 0 && (isReordering ? (
                    <Card size="none" variant="inset" className={cn("px-2", lines.length > 0 && "mt-3")} style={stopBadgeColumn}>
                        <Reorder.Group as="div" axis="y" values={stops} onReorder={reorderStops} className="flex flex-col">
                            {stops.map((pin, idx) => (
                                <SortableFavorite key={pin.stop.id} value={pin} sortable={stops.length > 1} onMove={moveStop}>
                                    {(handle) => (
                                        <FavoriteReorderRow
                                            lead={<StopLead stop={pin.stop} />}
                                            title={pin.stop.name}
                                            isFirst={idx === 0}
                                            dragHandle={handle}
                                        />
                                    )}
                                </SortableFavorite>
                            ))}
                        </Reorder.Group>
                    </Card>
                ) : (
                    // One card per stop: each is its own small board.
                    <div className={cn("flex flex-col gap-3", lines.length > 0 && "mt-3")} style={stopBadgeColumn}>
                        {stops.map(pin => (
                            <Card key={pin.stop.id} size="none" variant="inset" className="px-2 animate-in fade-in duration-200">
                                <FavoriteStopSection
                                    pins={pin.pins}
                                    stop={pin.stop}
                                    departures={departuresByStop.get(pin.stop.id) ?? []}
                                    isError={isError}
                                />
                            </Card>
                        ))}
                    </div>
                ))}
                </>
            )}
        </div>
    );
};

/** "From <stop>" for a pinned line, when its stop is known. */
const stopName = (stop: BoardStop | undefined, t: TFunction): string | undefined =>
    stop ? t('favorites.fromStop', { stop: stop.name }) : undefined;
