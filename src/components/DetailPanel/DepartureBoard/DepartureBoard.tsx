import { memo, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ChevronDown, ChevronRight, Train } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import type { DepartureClickHandler, Platform, SelectedStop, AppError } from '@/types';
import { useDepartures } from '@/hooks/data/useDepartures';
import { InfoTexts } from './InfoTexts';
import { VehicleFilterNotice } from './VehicleFilterNotice';
import { MetroNightMessage } from './MetroNightMessage';
import { DirectionRow } from './DirectionRow';
import { DepartureBoardSkeleton } from './DepartureBoardSkeleton';
import { ErrorState } from '@/components/DetailPanel/ErrorState';
import { DEPARTURES_CONFIG, FALLBACK_ROUTE_COLOR } from '@/config/constants';
import { groupsHidingTrips, isMetroClosed, sectionPreview, stationBoardSections, type DepartureLineGroup, type PlatformSection } from '@/domain/departures';
import { Button } from '@/components/ui/button';
import { isStationBoard, sectionStopId, servesMode } from '@/domain/stops';
import { useOpenStop } from '@/hooks/features/useOpenStop';
import { useCityConfig, useLineRules } from '@/hooks/data/useCities';
import { safeHexColor } from '@/lib/color';
import { badgeColumnStyle } from '@/lib/lineBadge';
import { PlatformCircle } from '@/components/PlatformCircle';
import { LineBadge } from '@/components/LineBadge';
import { useSelectionStore } from '@/state/selectionStore';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useRideStore } from '@/state/rideStore';
import { useNowEvery } from '@/hooks/useNow';

const NO_PLATFORMS: Platform[] = [];

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
    const { isLoading, isError, error, refetch, groupedDepartures, favoriteKeys, isFiltered, selectedLine, data, hiddenByVehicleFilters } = useDepartures();
    const lineRules = useLineRules();
    const { timezone } = useCityConfig();
    const highlightedTripId = useSelectionStore(s => s.highlightedTripId);
    const { board } = selectedStop;
    const boardStopId = board?.id ?? selectedStop.id;
    const departureSort = usePreferencesStore(s => s.departureSort);
    const onStation = !!board && isStationBoard(board);
    const sections = useMemo(
        () => onStation ? stationBoardSections(groupedDepartures, departureSort, favoriteKeys) : null,
        [onStation, groupedDepartures, departureSort, favoriteKeys]);
    const platforms = board?.platforms ?? NO_PLATFORMS;
    const sectionStopIds = useMemo(
        () => new Map(sections?.map(section => [section.key, sectionStopId(platforms, section, boardStopId)])),
        [sections, platforms, boardStopId]);
    const shownGroups = useMemo(() => sections?.flatMap(section => section.groups) ?? groupedDepartures, [sections, groupedDepartures]);
    const rideTripId = useRideStore(s => s.ride?.tripId ?? null);
    const followedTripId = useRideStore(s => s.followed?.tripId ?? null);
    const marked = useMemo(() => new Set([highlightedTripId, rideTripId, followedTripId].filter((id): id is string => !!id)), [highlightedTripId, rideTripId, followedTripId]);
    const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(() => new Set());
    /** Groups whose viewed or ridden trip sits below the collapsed rows open once, then follow the user's toggle. */
    const autoExpanded = useRef(new Set<string>());
    useEffect(() => {
        if (marked.size === 0) return;
        const toOpen = groupsHidingTrips(shownGroups, marked).filter(id => !autoExpanded.current.has(id));
        if (toOpen.length === 0) return;
        for (const id of toOpen) autoExpanded.current.add(id);
        setExpandedGroups(prev => new Set([...prev, ...toOpen]));
    }, [shownGroups, marked]);

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

    const fetchedDepartures = data?.departures;
    const jsonLd = useMemo(() => {
        if (!fetchedDepartures || fetchedDepartures.length === 0) return null;

        const upcoming = fetchedDepartures.slice(0, DEPARTURES_CONFIG.STRUCTURED_DATA_LIMIT).map(dep => ({
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
    }, [fetchedDepartures]);

    // One badge column for the whole board, as wide as its widest badge, so headsigns align and sit close.
    const badgeColumn = useMemo(() => badgeColumnStyle(groupedDepartures.map(group => String(group.line))), [groupedDepartures]);

    const rowProps = useMemo(
        () => ({ isFiltered, expandedGroups, onToggleGroup, boardStopId, timeZone: timezone, highlightedTripId, onDepartureClick }),
        [isFiltered, expandedGroups, onToggleGroup, boardStopId, timezone, highlightedTripId, onDepartureClick]);

    if (isLoading && groupedDepartures.length === 0) {
        return <DepartureBoardSkeleton />;
    }

    if (isError && groupedDepartures.length === 0) {
        return <ErrorState error={error as AppError} onRetry={refetch} />;
    }

    return (
        <div className="flex flex-col gap-3">
            {jsonLd && (
                <script type="application/ld+json">
                    {JSON.stringify(jsonLd)}
                </script>
            )}
            <VehicleFilterNotice hiddenCount={hiddenByVehicleFilters} />
            <InfoTexts selectedStop={selectedStop} />
            
            {groupedDepartures.length === 0 ? (
                <MetroClosedOr show={!isFiltered && !!board && servesMode(board, 'metro')} timeZone={timezone} closedHours={lineRules.metroClosedHours}>
                    <Empty className="py-12">
                        <EmptyHeader>
                            <EmptyMedia
                                variant="icon"
                                className="size-14 rounded-2xl bg-muted/30 border border-border/50 text-muted-foreground shadow-sm [&_svg:not([class*='size-'])]:size-7"
                            >
                                <Train strokeWidth={1.5} className="opacity-50" />
                            </EmptyMedia>
                            <EmptyTitle className="text-base font-bold text-foreground/80">
                                {selectedLine
                                    ? t('map.departures.noUpcomingForLine', { line: selectedLine })
                                    : t('map.departures.noUpcoming')}
                            </EmptyTitle>
                            <EmptyDescription className="text-sm">
                                {t('map.departures.noUpcomingDescription')}
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                </MetroClosedOr>
            ) : (
                sections ? (
                    sections.map(section => (
                        <PlatformSectionView
                            key={section.key}
                            section={section}
                            platformStopId={sectionStopIds.get(section.key) ?? null}
                            markedTripIds={marked}
                            badgeColumn={badgeColumn}
                            rowProps={rowProps}
                        />
                    ))
                ) : (
                    <Card size="none" variant="inset" className="px-2" style={badgeColumn}>
                        <DirectionRows groups={groupedDepartures} inPlatformSection={false} {...rowProps} />
                    </Card>
                )
            )}
        </div>
    );
});

DepartureBoard.displayName = 'DepartureBoard';

/** The metro's closed-hours message on an empty metro board while the metro sleeps, else `children`; only it follows the clock. */
const MetroClosedOr = ({ show, timeZone, closedHours, children }: { show: boolean; timeZone: string; closedHours: [number, number] | null; children: React.ReactNode }) => {
    const now = useNowEvery(DEPARTURES_CONFIG.METRO_CLOSED_CHECK_MS);
    return show && isMetroClosed(now, timeZone, closedHours) ? <MetroNightMessage /> : children;
};

interface DirectionRowsProps {
    groups: DepartureLineGroup[];
    inPlatformSection: boolean;
    isFiltered: boolean;
    expandedGroups: ReadonlySet<string>;
    onToggleGroup: (groupId: string) => void;
    boardStopId: string;
    timeZone: string;
    highlightedTripId: string | null;
    onDepartureClick: DepartureClickHandler;
}

/** The board's rows, one per line and headsign, a line's headsigns following each other without a divider. */
const DirectionRows = ({ groups, inPlatformSection, isFiltered, expandedGroups, onToggleGroup, boardStopId, timeZone, highlightedTripId, onDepartureClick }: DirectionRowsProps) =>
    groups.map((lineGroup, groupIdx) => lineGroup.subGroups.map((subGroup, subIdx) => {
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
                inPlatformSection={inPlatformSection}
                timeZone={timeZone}
                highlightedTripId={highlightedTripId}
                onDepartureClick={onDepartureClick}
            />
        );
    }));

interface PlatformSectionViewProps {
    section: PlatformSection;
    platformStopId: string | null;
    markedTripIds: ReadonlySet<string>;
    badgeColumn: React.CSSProperties;
    rowProps: Omit<DirectionRowsProps, 'groups' | 'inPlatformSection'>;
}

/** One platform's section of a station board: its first lines, the rest behind a button. */
const PlatformSectionView = memo(({ section, platformStopId, markedTripIds, badgeColumn, rowProps }: PlatformSectionViewProps) => {
    const { t } = useTranslation();
    const [showAll, setShowAll] = useState(false);
    const { shown, hidden } = useMemo(
        () => sectionPreview(section.groups, DEPARTURES_CONFIG.SECTION_PREVIEW_LINES, markedTripIds),
        [section.groups, markedTripIds]);
    const groups = showAll ? section.groups : shown;
    return (
        <section className="flex flex-col gap-1.5">
            {section.key && <PlatformHeader section={section} platformStopId={platformStopId} />}
            <Card size="none" variant="inset" className="px-2" style={badgeColumn}>
                {/* A metro line's rows name their track, which is the line's own. */}
                <DirectionRows groups={groups} inPlatformSection={!section.metroLine} {...rowProps} />
                {hidden > 0 && (
                    <div className="flex justify-center border-t border-border/50 py-2.5">
                        <Button variant="more" size="chip" aria-expanded={showAll} onClick={() => setShowAll(open => !open)}>
                            {showAll ? t('map.departures.fewerLines') : t('map.departures.moreLines', { count: hidden })}
                            <ChevronDown size={14} strokeWidth={2} className={cn("transition-transform duration-200", showAll && "rotate-180")} />
                        </Button>
                    </div>
                )}
            </Card>
        </section>
    );
});
PlatformSectionView.displayName = 'PlatformSectionView';

interface PlatformHeaderProps {
    section: PlatformSection;
    /** The platform's own board; null when the stop list does not know the platform. */
    platformStopId: string | null;
}

/** A station board's platform section title, opening that platform's own board. */
const PlatformHeader = ({ section, platformStopId }: PlatformHeaderProps) => {
    const { t } = useTranslation();
    const openStop = useOpenStop();
    const title = section.metroLine ? (
        <>
            <LineBadge name={section.metroLine} routeColor={section.metroColor ?? FALLBACK_ROUTE_COLOR} />
            <span className="flex-1 text-body-sm font-semibold text-foreground">{t('map.departures.metroSection', { line: section.metroLine })}</span>
        </>
    ) : section.platform ? (
        <>
            <PlatformCircle code={section.platform} size="md" />
            <span className="flex-1 text-body-sm font-semibold text-foreground">
                {t('map.departures.platformSection', { code: section.platform })}
            </span>
        </>
    ) : (
        <span className="flex min-w-0 flex-1 items-center gap-2 text-body-sm font-semibold text-foreground">
            <ArrowRight size={16} strokeWidth={2} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{t('map.departures.towardsSection', { stop: section.direction })}</span>
        </span>
    );
    if (!platformStopId) return <div className="flex items-center gap-2 px-2 py-1">{title}</div>;
    return (
        <button
            type="button"
            onClick={() => openStop(platformStopId)}
            className="flex items-center gap-2 rounded-lg px-2 py-1 text-left outline-none transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring/50"
        >
            {title}
            <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
    );
};
