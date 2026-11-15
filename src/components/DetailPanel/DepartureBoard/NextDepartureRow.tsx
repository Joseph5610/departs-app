import type React from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { InterchangeBadges } from '@/components/InterchangeBadges';
import { LineBadge } from '@/components/LineBadge';
import { useInterchanges } from '@/hooks/derived/useInterchanges';
import { useTripMark } from '@/hooks/derived/useTripMark';
import { useDepartureTap } from '@/hooks/features/useTapClick';
import type { Departure, DepartureClickHandler } from '@/types';
import { BoardRow, RowHeadsign, RowTimeLine, type RowAction } from './BoardRow';
import { Amenities, ExpectedTime, LiveCountdown, MARKED_BACKDROP, TripNotes } from './DepartureParts';
import { MyTripChip } from './MyTripChip';
import { useMyTripEntry } from '@/hooks/features/useMyTripEntry';

interface NextDepartureRowProps {
    departure: Departure;
    line: string;
    headsign: string;
    routeColor: string;
    /** The metro track, shown with the departure time like a train platform. */
    track: string | null;
    /** The train platform, shown with the departure time. */
    platform: string | null;
    timeZone: string;
    isHighlighted: boolean;
    onDepartureClick: DepartureClickHandler;
    /** A line's further direction leaves the badge to the row above, so the line reads as one group. */
    hidesBadge?: boolean;
    /** What swiping the row or right-clicking it does; its being active stars the headsign. */
    action?: RowAction;
    /** Content under the row in the headsign column, e.g. the later departures. */
    children?: React.ReactNode;
    /** Overrides the row's test id, `departure-item-<tripId>` by default. */
    testId?: string;
}

const activateOnKey = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    e.currentTarget.click();
};

/**
 * A departure as the lead row of a direction: badge, headsign and live countdown, then its departure time,
 * amenities and notes. A div with the button role, as a button's inner box breaks the row's subgrid.
 */
export const NextDepartureRow = memo(({
    departure: dep, line, headsign, routeColor, track, platform, timeZone, isHighlighted, onDepartureClick, hidesBadge, action, children, testId,
}: NextDepartureRowProps) => {
    const { t } = useTranslation();
    const { forHeadsign } = useInterchanges();
    const mark = useTripMark(dep.tripId, isHighlighted);
    const tap = useDepartureTap(dep, onDepartureClick);
    const trip = useMyTripEntry(dep);

    return (
        <BoardRow
            role="button"
            tabIndex={0}
            {...tap}
            onKeyDown={activateOnKey}
            data-testid={testId ?? `departure-item-${dep.tripId}`}
            action={action}
            tripAction={trip ? { onTrigger: trip.open, label: trip.label, swipeLabel: trip.swipeLabel, isActive: trip.isSet } : undefined}
            below={children}
            className={cn(
                "row-hover-board",
                mark && MARKED_BACKDROP
            )}
        >
            {!hidesBadge && <LineBadge name={line} routeColor={routeColor} size="lg" className="justify-self-start" />}
            <RowHeadsign headsign={headsign} isPinned={action?.isActive}><InterchangeBadges codes={forHeadsign(dep.headsign, dep.line)} /></RowHeadsign>
            <LiveCountdown departure={dep} size="lg" />

            <RowTimeLine>
                {t('map.departures.departs')}
                <ExpectedTime departure={dep} timeZone={timeZone} />
                {track && <><span aria-hidden="true">·</span><span className="whitespace-nowrap">{t('map.departures.trackCode', { code: track })}</span></>}
                {platform && <><span aria-hidden="true">·</span><span className="whitespace-nowrap">{t('map.departures.platformCode', { code: platform })}</span></>}
                <MyTripChip departure={dep} />
            </RowTimeLine>
            <span className="col-start-3 row-start-2 mt-0.5 flex h-4.5 items-center justify-self-end"><Amenities departure={dep} /></span>

            <TripNotes departure={dep} mark={mark} className="col-span-2 col-start-2 row-start-3 mt-1" />
        </BoardRow>
    );
});

NextDepartureRow.displayName = 'NextDepartureRow';
