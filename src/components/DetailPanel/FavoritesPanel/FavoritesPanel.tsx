import { cn } from '@/lib/cn';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Reorder } from 'framer-motion';
import { Star } from 'lucide-react';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useUiStore } from '@/state/uiStore';
import { useFavorites } from '@/hooks/derived/useFavorites';
import { useFavoriteDepartures } from '@/hooks/data/useFavoriteDepartures';
import { moveShown, nextDepartures } from '@/domain/departures';
import { DEPARTURES_CONFIG, FALLBACK_ROUTE_COLOR } from '@/config/constants';
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
import type { TFunction } from 'i18next';
import type { BoardStop, FavoriteLine, PinnedStop } from '@/types';
import { EmptyState } from '@/components/EmptyState';

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

    const isReordering = useUiStore(s => s.isReorderingFavorites);
    const setIsReordering = useUiStore(s => s.actions.setIsReorderingFavorites);
    useEffect(() => () => setIsReordering(false), [setIsReordering]);
    // Each list shares one badge column, as wide as its widest badge, like the rows of a board.
    const lineBadgeColumn = useMemo(() => badgeColumnStyle(lines.map(fav => fav.line)), [lines]);
    const stopBadgeColumn = useMemo(() => badgeColumnStyle(stops.flatMap(pin =>
        nextDepartures(departuresByStop.get(pin.stop.id) ?? [], DEPARTURES_CONFIG.FAVORITE_CARD_COUNT).map(dep => String(dep.line))
    )), [stops, departuresByStop]);
    const isLoading = stopsLoading || departuresLoading;
    const showsStops = hasTabs ? tab === 'stops' : favoriteLines.length === 0;

    // Pinned stops resolve with the stop list, so they count as pinned until it has loaded.
    if (favoriteLines.length === 0 && (pinnedStopCount === 0 || (!isLoading && favoriteStops.length === 0))) {
        return (
            <EmptyState icon={Star} tone="positive" title={t('favorites.empty')} description={t('favorites.emptySub')} className="py-16" />
        );
    }

    return (
        <div className="flex flex-col">
            {isLoading ? (
                <FavoritesSkeleton kind={showsStops ? 'stops' : 'lines'} count={hasTabs ? lines.length + stops.length : pinnedStopCount + favoriteLines.length} />
            ) : (
                <>
                {lines.length > 0 && (
                    <Card size="none" className="px-3.5" style={lineBadgeColumn}>
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
                    <Card size="none" className={cn("px-3.5", lines.length > 0 && "mt-3")} style={stopBadgeColumn}>
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
                    // Each stop is its own small board, its header above its card.
                    <div className={cn("flex flex-col gap-5", lines.length > 0 && "mt-5")} style={stopBadgeColumn}>
                        {stops.map(pin => (
                            <FavoriteStopSection
                                key={pin.stop.id}
                                pins={pin.pins}
                                stop={pin.stop}
                                departures={departuresByStop.get(pin.stop.id) ?? []}
                                isError={isError}
                            />
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
