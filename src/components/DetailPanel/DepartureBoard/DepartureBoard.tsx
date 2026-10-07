import { memo, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { Train, ArrowRight, ChevronDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconTooltip } from '@/components/IconTooltip';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { cn } from 'cn';
import type { Departure, SelectedStop, AppError } from '@/types';
import { useDepartures } from '@/hooks/data/useDepartures';
import { DepartureItem } from './DepartureItem';
import { InfoTexts } from './InfoTexts';
import { MetroNightMessage } from './MetroNightMessage';
import { DepartureBoardSkeleton } from './DepartureBoardSkeleton';
import { ErrorState } from '@/components/DetailPanel/ErrorState';
import { LineBadge } from '@/components/LineBadge';
import { DEPARTURES_CONFIG, FALLBACK_ROUTE_COLOR } from '@/config/constants';
import { groupsHidingTrips, isMetroClosed, visibleInGroup } from '@/domain/departures';
import { useCityConfig, useLineRules } from '@/hooks/data/useCities';
import { useInterchanges } from '@/hooks/derived/useInterchanges';
import { InterchangeBadges } from '@/components/InterchangeBadges';
import { safeHexColor } from '@/lib/color';
import { PinLineButton } from './PinLineButton';
import { useSelectionStore } from '@/state/selectionStore';
import { useRideStore } from '@/state/rideStore';
import { useRouteParams } from '@/hooks/useRouteParams';

interface DepartureBoardProps {
    selectedStop: SelectedStop;
    onDepartureClick: (tripId: string, vehicleId?: string, initialData?: Partial<Departure>) => void;
}

/**
 * DepartureBoard
 *
 * Renders the list of upcoming departures for a selected stop,
 * grouped by line and type. High-density tabular layout.
 */
export const DepartureBoard = memo(({ selectedStop, onDepartureClick }: DepartureBoardProps) => {
    const { t } = useTranslation();
    const { isLoading, isError, error, refetch, groupedDepartures, isFiltered, selectedLine, data } = useDepartures();
    const lineRules = useLineRules();
    const { timezone } = useCityConfig();
    const { forHeadsign } = useInterchanges();
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
                groupedDepartures.map((lineGroup) => {
                    const firstSub = lineGroup.subGroups[0];
                    const firstDep = firstSub.departures[0];
                    const isMetro = firstDep.type === 'metro';
                    return (
                        <Card 
                            key={lineGroup.lineGroupId} 
                            size="none"
                            variant="panel"
                            className="mb-3 overflow-hidden"
                        >
                            {lineGroup.subGroups.map((subGroup, subIdx) => {
                                const isFirstSub = subIdx === 0;
                                
                                const subFirstDep = subGroup.departures[0];
                                const routeColor = safeHexColor(subFirstDep.route_color);
                                const isExpanded = isFiltered || expandedGroups.has(subGroup.groupId);
                                
                                const { visible: visibleDepartures, hiddenCount, hasMore } = visibleInGroup(subGroup.departures, isExpanded, isFiltered);

                                return (
                                    <div key={subGroup.groupId} className="flex flex-col">
                                        {isFirstSub ? (
                                            /* Main Header - Vibrant Sophisticated Gradient */
                                            <CardHeader 
                                                className="p-0 pb-0! bg-transparent relative border-b-0"
                                            >
                                                <div 
                                                    className="absolute inset-0 pointer-events-none dark:hidden opacity-[0.15] rounded-t-2xl"
                                                    style={{
                                                        background: routeColor
                                                            ? `linear-gradient(90deg, ${routeColor} 0%, transparent 100%)`
                                                            : 'none'
                                                    }}
                                                />
                                                <div 
                                                    className="absolute inset-0 pointer-events-none hidden dark:block rounded-t-2xl"
                                                    style={{
                                                        background: routeColor
                                                            ? `linear-gradient(90deg, color-mix(in srgb, color-mix(in srgb, ${routeColor}, white 15%), black 50%) 0%, color-mix(in srgb, color-mix(in srgb, ${routeColor}, white 15%), black 70%) 100%)`
                                                            : 'rgba(255,255,255,0.1)'
                                                    }}
                                                />
                                                <div className="relative z-10 flex items-center gap-2 p-3 px-4 w-full min-w-0 border-b-2"
                                                     style={{
                                                         borderBottomColor: routeColor
                                                             ? `color-mix(in srgb, ${routeColor} 60%, transparent)`
                                                             : 'rgba(255,255,255,0.15)'
                                                     }}
                                                >
                                                <LineBadge 
                                                    name={String(lineGroup.line)} 
                                                    routeColor={routeColor || FALLBACK_ROUTE_COLOR}
                                                    size="lg" 
                                                    className="shadow-sm" 
                                                />
                                                <ArrowRight size={14} strokeWidth={1.5} className="text-muted-foreground opacity-40 shrink-0" />
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <CardTitle className="text-[15px] font-semibold truncate min-w-0 text-foreground">
                                                                {subGroup.headsign}
                                                            </CardTitle>
                                                            <InterchangeBadges codes={forHeadsign(subFirstDep.headsign, subFirstDep.line)} />
                                                        </div>
                                                    </div>

                                                {isMetro && subFirstDep.platform && (
                                                    <IconTooltip
                                                        label={t('map.departures.trackNumber', { track: subFirstDep.platform })}
                                                        className="justify-center w-5 h-5 bg-foreground rounded-full shadow-sm"
                                                    >
                                                        <span className="text-background font-extrabold text-xs leading-none text-center inline-block">
                                                            {subFirstDep.platform}
                                                        </span>
                                                    </IconTooltip>
                                                )}
                                                <PinLineButton stopId={boardStopId} line={String(lineGroup.line)} headsign={subGroup.headsign} />
                                                </div>
                                            </CardHeader>
                                        ) : (
                                            /* Secondary Variant Header - Vibrant Glow Style */
                                            <div className="relative overflow-hidden border-t border-border/50 dark:border-white/5">
                                                <div 
                                                    className="absolute inset-0 pointer-events-none dark:hidden opacity-[0.10]"
                                                    style={{
                                                        background: routeColor
                                                            ? `linear-gradient(90deg, ${routeColor} 0%, transparent 100%)`
                                                            : 'none'
                                                    }}
                                                />
                                                <div 
                                                    className="absolute inset-0 pointer-events-none hidden dark:block"
                                                    style={{
                                                        background: routeColor
                                                            ? `linear-gradient(90deg, color-mix(in srgb, color-mix(in srgb, ${routeColor}, white 15%), black 50%) 0%, color-mix(in srgb, color-mix(in srgb, ${routeColor}, white 15%), black 70%) 100%)`
                                                            : 'rgba(255,255,255,0.1)'
                                                    }}
                                                />
                                                <div className="relative z-10 flex items-center gap-3 px-0 py-2.5 w-full min-w-0">
                                                    <div 
                                                        className="w-1 h-4 rounded-r-sm shrink-0" 
                                                        style={{ backgroundColor: routeColor || FALLBACK_ROUTE_COLOR }}
                                                    />
                                                    <div className="flex items-center gap-2 flex-1 min-w-0 pr-4">
                                                        <ArrowRight size={12} strokeWidth={1.5} className="text-muted-foreground opacity-40 shrink-0" />
                                                        <span className="text-foreground/90 text-sm font-bold truncate flex-1 min-w-0">
                                                            {subGroup.headsign}
                                                        </span>
                                                        <PinLineButton stopId={boardStopId} line={String(lineGroup.line)} headsign={subGroup.headsign} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <CardContent className="p-0">
                                            <div className="flex flex-col divide-y divide-black/5 dark:divide-white/5">
                                                {visibleDepartures.map((dep: Departure, idx: number) => (
                                                    <div 
                                                        key={dep.tripId ? `${dep.tripId}-${dep.scheduled}` : idx}
                                                        className={cn(
                                                            "transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.04]",
                                                            idx % 2 === 1 ? "bg-black/[0.015] dark:bg-white/[0.02]" : "bg-transparent"
                                                        )}
                                                    >
                                                        <DepartureItem
                                                            departure={dep}
                                                            timeZone={timezone}
                                                            onDepartureClick={onDepartureClick}
                                                            hideHeadsign={true}
                                                            isHighlighted={!!dep.tripId && dep.tripId === highlightedTripId}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>

                                        {hasMore && (
                                            <Button
                                                variant="ghost"
                                                onClick={() => onToggleGroup(subGroup.groupId)}
                                                className={cn(
                                                    "w-full h-auto py-2.5 flex items-center justify-center gap-2 bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.08] transition-colors border-t border-black/5 dark:border-white/5 text-muted-foreground/70 dark:text-muted-foreground/60 hover:text-foreground text-[10.5px] font-bold uppercase tracking-wider",
                                                    subIdx === lineGroup.subGroups.length - 1 ? "rounded-b-[11px] rounded-t-none" : "rounded-none"
                                                )}
                                            >
                                                <ChevronDown 
                                                    size={14} 
                                                    className={cn("transition-transform duration-200", isExpanded && "rotate-180")} 
                                                 strokeWidth={1.5} />
                                                <span>
                                                    {isExpanded 
                                                        ? t('map.departures.showLess') 
                                                        : t('map.departures.moreConnections', { count: hiddenCount })}
                                                </span>
                                            </Button>
                                        )}
                                    </div>
                                );
                            })}
                        </Card>
                    );
                })
            )}
        </div>
    );
});

DepartureBoard.displayName = 'DepartureBoard';
