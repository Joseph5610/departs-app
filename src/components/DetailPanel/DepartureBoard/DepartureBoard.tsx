import { memo, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { Train } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import type { DepartureClickHandler, SelectedStop, AppError } from '@/types';
import { useDepartures } from '@/hooks/data/useDepartures';
import { InfoTexts } from './InfoTexts';
import { MetroNightMessage } from './MetroNightMessage';
import { DirectionRow } from './DirectionRow';
import { DepartureBoardSkeleton } from './DepartureBoardSkeleton';
import { ErrorState } from '@/components/DetailPanel/ErrorState';
import { DEPARTURES_CONFIG, FALLBACK_ROUTE_COLOR } from '@/config/constants';
import { groupsHidingTrips, isMetroClosed } from '@/domain/departures';
import { useCityConfig, useLineRules } from '@/hooks/data/useCities';
import { safeHexColor } from '@/lib/color';
import { badgeColumnStyle } from '@/lib/lineBadge';
import { useSelectionStore } from '@/state/selectionStore';
import { useRideStore } from '@/state/rideStore';
import { useRouteParams } from '@/hooks/useRouteParams';

interface DepartureBoardProps {
    selectedStop: SelectedStop;
    onDepartureClick: DepartureClickHandler;
}

/**
 * DepartureBoard
 *
 * Renders the upcoming departures of a selected stop as one row per line and headsign, a line's
 * headsigns following each other without a divider.
 */
export const DepartureBoard = memo(({ selectedStop, onDepartureClick }: DepartureBoardProps) => {
    const { t } = useTranslation();
    const { isLoading, isError, error, refetch, groupedDepartures, isFiltered, selectedLine, data } = useDepartures();
    const lineRules = useLineRules();
    const { timezone } = useCityConfig();
    const highlightedTripId = useSelectionStore(s => s.highlightedTripId);
    const { stopId: routeStopId } = useRouteParams();
    // Pins and the departures query both key on the stop id in the URL.
    const boardStopId = routeStopId ?? selectedStop.stop_id;
    const rideTripId = useRideStore(s => s.ride?.tripId ?? null);
    const followedTripId = useRideStore(s => s.followed?.tripId ?? null);
    /** Groups whose viewed or ridden trip sits below the collapsed rows open once, then follow the user's toggle. */
    const autoExpanded = useRef(new Set<string>());
    useEffect(() => {
        if (!highlightedTripId && !rideTripId && !followedTripId) return;
        const marked = new Set([highlightedTripId, rideTripId, followedTripId].filter((id): id is string => !!id));
        const toOpen = groupsHidingTrips(groupedDepartures, marked).filter(id => !autoExpanded.current.has(id));
        if (toOpen.length === 0) return;
        for (const id of toOpen) autoExpanded.current.add(id);
        setExpandedGroups(prev => new Set([...prev, ...toOpen]));
    }, [groupedDepartures, highlightedTripId, rideTripId, followedTripId]);

    const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(() => new Set());

    // Re-runs on expansion: a highlighted trip in a collapsed group only has a row once its group opens.
    const scrolledTo = useRef<string | null>(null);
    useEffect(() => {
        if (!highlightedTripId || scrolledTo.current === highlightedTripId) return;
        const row = document.querySelector(`[data-testid="departure-item-${CSS.escape(highlightedTripId)}"]`);
        if (!row) return;
        scrolledTo.current = highlightedTripId;
        row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, [highlightedTripId, groupedDepartures, expandedGroups]);

    const onToggleGroup = useCallback((group: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(group)) next.delete(group);
            else next.add(group);
            return next;
        });
    }, []);

    const jsonLd = useMemo(() => {
        if (!data?.departures || data.departures.length === 0) return null;
        
        const upcoming = data.departures.slice(0, DEPARTURES_CONFIG.STRUCTURED_DATA_LIMIT).map(dep => ({
            "@type": "TrainTrip",
            "trainNumber": String(dep.line),
            "trainName": dep.headsign,
            "departureTime": dep.scheduled,
            "description": `Delay: ${dep.delay || 0} seconds`,
            "departurePlatform": dep.platform || undefined
        }));

        return {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": "Live Departures",
            "itemListElement": upcoming
        };
    }, [data?.departures]);

    // One badge column for the whole board, as wide as its widest badge, so headsigns align and sit close.
    const badgeColumn = useMemo(() => badgeColumnStyle(groupedDepartures.map(group => String(group.line))), [groupedDepartures]);

    const showMetroNightMessage = useMemo(() => {
        if (groupedDepartures.length > 0) return false;
        if (isFiltered) return false;
        return (selectedStop.metro_lines?.length ?? 0) > 0 && isMetroClosed(Date.now(), timezone, lineRules.metroClosedHours);
    }, [selectedStop, groupedDepartures.length, isFiltered, lineRules, timezone]);

    if (isLoading && groupedDepartures.length === 0) {
        return <DepartureBoardSkeleton />;
    }

    if (isError && groupedDepartures.length === 0) {
        return <ErrorState error={error as AppError} onRetry={refetch} />;
    }

    return (
        <div className="flex flex-col gap-3">
            {jsonLd && (
                <Helmet>
                    <script type="application/ld+json">
                        {JSON.stringify(jsonLd)}
                    </script>
                </Helmet>
            )}
            <InfoTexts selectedStop={selectedStop} />
            
            {groupedDepartures.length === 0 ? (
                showMetroNightMessage ? (
                    <MetroNightMessage />
                ) : (
                    <Empty className="py-12">
                        <EmptyHeader>
                            <EmptyMedia
                                variant="icon"
                                className="size-14 rounded-2xl bg-muted/30 border border-border/50 text-muted-foreground shadow-sm [&_svg:not([class*='size-'])]:size-7"
                            >
                                <Train strokeWidth={1.5} className="opacity-50" />
                            </EmptyMedia>
                            <EmptyTitle className="text-base font-bold text-foreground/80">
                                {isFiltered 
                                    ? t('map.departures.noUpcomingForLine', { line: selectedLine }) 
                                    : t('map.departures.noUpcoming')}
                            </EmptyTitle>
                            <EmptyDescription className="text-sm">
                                {t('map.departures.noUpcomingDescription')}
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                )
            ) : (
                <Card size="none" variant="inset" className="px-2" style={badgeColumn}>
                    {groupedDepartures.map((lineGroup, groupIdx) => lineGroup.subGroups.map((subGroup, subIdx) => {
                        const first = subGroup.departures[0];
                        return (
                            <DirectionRow
                                key={subGroup.groupId}
                                groupId={subGroup.groupId}
                                line={String(lineGroup.line)}
                                headsign={subGroup.headsign}
                                departures={subGroup.departures}
                                routeColor={safeHexColor(first.route_color) || FALLBACK_ROUTE_COLOR}
                                startsLine={subIdx === 0}
                                isFirst={groupIdx === 0 && subIdx === 0}
                                isExpanded={isFiltered || expandedGroups.has(subGroup.groupId)}
                                isFiltered={isFiltered}
                                onToggleGroup={onToggleGroup}
                                boardStopId={boardStopId}
                                timeZone={timezone}
                                highlightedTripId={highlightedTripId}
                                onDepartureClick={onDepartureClick}
                            />
                        );
                    }))}
                </Card>
            )}
        </div>
    );
});

DepartureBoard.displayName = 'DepartureBoard';
