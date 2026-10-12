import type React from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { boardingPlace, departureKey, visibleInGroup } from '@/domain/departures';
import { useTripMark } from '@/hooks/derived/useTripMark';
import { useDepartureTap } from '@/hooks/features/useTapClick';
import { usePinLine } from '@/hooks/features/usePinLine';
import type { Departure, DepartureClickHandler } from '@/types';
import { DepartureChip } from './DepartureChip';
import { NextDepartureRow } from './NextDepartureRow';
import { Amenities, ExpectedTime, LiveCountdown, MARKED_ROW, TripNotes } from './DepartureParts';
import { RowSeparator } from './RowSeparator';
import { BoardSection } from './BoardRow';

interface DirectionRowProps {
    groupId: string;
    line: string;
    headsign: string;
    /** This direction's departures, soonest first. */
    departures: Departure[];
    routeColor: string;
    /** Opens a new line on the board; a line's further directions follow without a divider or badge. */
    startsLine: boolean;
    isFirst: boolean;
    isExpanded: boolean;
    isFiltered: boolean;
    /** Without it the direction shows only its visible departures, with no way to expand. */
    onToggleGroup?: (groupId: string) => void;
    boardStopId: string;
    timeZone: string;
    highlightedTripId: string | null;
    onDepartureClick: DepartureClickHandler;
    /** A line under the next departure, e.g. a link to the stop a pinned line leaves from. */
    note?: React.ReactNode;
}

/**
 * DirectionRow
 *
 * One line and headsign on the departure board: the next departure with its live countdown, delay and
 * expected time, then the later departures as chips, or all of them as rows once expanded.
 */
export const DirectionRow = memo(({
    groupId, line, headsign, departures, routeColor, startsLine, isFirst,
    isExpanded, isFiltered, onToggleGroup, boardStopId, timeZone, highlightedTripId, onDepartureClick, note,
}: DirectionRowProps) => {
    const { t } = useTranslation();
    const pin = usePinLine(boardStopId, line, headsign);
    const { visible, hiddenCount, hasMore: canExpand } = visibleInGroup(departures, isExpanded, isFiltered);
    const hasMore = canExpand && !!onToggleGroup;
    const [next, ...later] = visible;
    const showsList = isExpanded || isFiltered;
    const showsChips = !showsList && later.length > 0;
    const showsRows = showsList && later.length > 0;

    return (
        <>
        {startsLine && !isFirst && <RowSeparator />}
        <BoardSection continuesLine={!startsLine}>
            <NextDepartureRow
                departure={next}
                line={line}
                headsign={headsign}
                routeColor={routeColor}
                {...boardingPlace(next)}
                timeZone={timeZone}
                isHighlighted={!!next.tripId && next.tripId === highlightedTripId}
                onDepartureClick={onDepartureClick}
                hidesBadge={!startsLine}
                action={{ onTrigger: pin.toggle, isActive: pin.isPinned }}
            >
                {(showsChips || showsRows || hasMore || note) && (
                    <>
                    {note}
                    {showsRows && (
                        <div className="flex flex-col">
                            {later.map(dep => (
                                <TripRow
                                    key={departureKey(dep)}
                                    departure={dep}
                                    timeZone={timeZone}
                                    isHighlighted={!!dep.tripId && dep.tripId === highlightedTripId}
                                    onDepartureClick={onDepartureClick}
                                />
                            ))}
                        </div>
                    )}
                    {(showsChips || hasMore) && (
                        <div className={cn("flex min-w-0 flex-wrap items-center gap-1.5", showsRows && "-mt-2")}>
                            {showsChips && later.map(dep => (
                                <DepartureChip
                                    key={departureKey(dep)}
                                    departure={dep}
                                    timeZone={timeZone}
                                    isHighlighted={!!dep.tripId && dep.tripId === highlightedTripId}
                                    onDepartureClick={onDepartureClick}
                                />
                            ))}
                            {hasMore && (
                                // Shaped like the chips it extends, so it reads as "more departures", not as a menu.
                                <Button
                                    variant="ghost"
                                    onClick={() => onToggleGroup?.(groupId)}
                                    aria-label={isExpanded ? t('map.departures.showLess') : t('map.departures.moreConnections', { count: hiddenCount })}
                                    aria-expanded={isExpanded}
                                    className="h-7 gap-1 rounded-full border border-dashed border-foreground/20 px-2.5 text-body-sm font-semibold tabular-nums text-muted-foreground hover:border-foreground/30 hover:bg-foreground/5 hover:text-foreground"
                                >
                                    {isExpanded ? t('map.departures.showLess') : `+${hiddenCount}`}
                                    <ChevronDown size={14} strokeWidth={2} className={cn("transition-transform duration-200", isExpanded && "rotate-180")} />
                                </Button>
                            )}
                        </div>
                    )}
                    </>
                )}
            </NextDepartureRow>
        </BoardSection>
        </>
    );
});

DirectionRow.displayName = 'DirectionRow';

interface TripRowProps {
    departure: Departure;
    timeZone: string;
    isHighlighted: boolean;
    onDepartureClick: DepartureClickHandler;
}

/** A later departure in an expanded direction, laid out like the next one: its time and amenities, then the live countdown. */
const TripRow = memo(({ departure: dep, timeZone, isHighlighted, onDepartureClick }: TripRowProps) => {
    const mark = useTripMark(dep.tripId, isHighlighted);
    const tap = useDepartureTap(dep, onDepartureClick);

    return (
        <Button
            variant="ghost"
            {...tap}
            data-testid={`departure-item-${dep.tripId}`}
            className={cn(
                "-mx-2 grid h-auto w-[calc(100%+1rem)] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 whitespace-normal rounded-lg px-2 py-2 text-left font-normal hover:bg-foreground/5",
                mark && MARKED_ROW
            )}
        >
            <span className="flex min-w-0 items-center gap-3 text-body-sm text-muted-foreground">
                <ExpectedTime departure={dep} timeZone={timeZone} />
                <Amenities departure={dep} />
            </span>
            <LiveCountdown departure={dep} size="md" />
            <TripNotes departure={dep} mark={mark} className="col-span-2" />
        </Button>
    );
});

TripRow.displayName = 'TripRow';
