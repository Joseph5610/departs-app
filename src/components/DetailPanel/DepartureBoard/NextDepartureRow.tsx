import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { InterchangeBadges } from '@/components/InterchangeBadges';
import { LineBadge } from '@/components/LineBadge';
import { PlatformCircle } from '@/components/PlatformCircle';
import { useInterchanges } from '@/hooks/derived/useInterchanges';
import { useTripMark } from '@/hooks/derived/useTripMark';
import { useDepartureTap } from '@/hooks/features/useTapClick';
import type { Departure, DepartureClickHandler } from '@/types';
import { wrappableName } from '@/lib/strings';
import { Amenities, ExpectedTime, LiveCountdown, MARKED_ROW, TripNotes } from './DepartureParts';

interface NextDepartureRowProps {
    departure: Departure;
    line: string;
    headsign: string;
    routeColor: string;
    /** The metro track, shown in a circle before the headsign. */
    track: string | null;
    /** The train platform, shown with the departure time. */
    platform: string | null;
    timeZone: string;
    isHighlighted: boolean;
    onDepartureClick: DepartureClickHandler;
    /** Overrides the row's test id, `departure-item-<tripId>` by default. */
    testId?: string;
}

/** A departure as the lead row of a direction: badge, headsign and live countdown, then its departure time, amenities and notes. */
export const NextDepartureRow = memo(({ departure: dep, line, headsign, routeColor, track, platform, timeZone, isHighlighted, onDepartureClick, testId }: NextDepartureRowProps) => {
    const { t } = useTranslation();
    const { forHeadsign } = useInterchanges();
    const mark = useTripMark(dep.tripId, isHighlighted);
    const tap = useDepartureTap(dep, onDepartureClick);

    return (
        <Button
            variant="ghost"
            {...tap}
            data-testid={testId ?? `departure-item-${dep.tripId}`}
            className={cn(
                "grid h-auto w-full grid-cols-[var(--badge-col)_minmax(0,1fr)_auto] items-start gap-x-2.5 gap-y-1 whitespace-normal rounded-xl py-2 pl-1.5 pr-2 text-left font-normal hover:bg-foreground/5",
                mark && MARKED_ROW
            )}
        >
            <LineBadge name={line} routeColor={routeColor} size="lg" className="justify-self-center" />
            {/* Long headsigns wrap; interchanges follow on the same line or wrap after it. */}
            <span className="flex min-h-6 min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                {track && <PlatformCircle code={track} label={t('map.departures.trackNumber', { track })} />}
                <span className="min-w-0 text-title font-semibold leading-tight text-foreground [overflow-wrap:break-word]">{wrappableName(headsign)}</span>
                <InterchangeBadges codes={forHeadsign(dep.headsign, dep.line)} />
            </span>
            <LiveCountdown departure={dep} size="lg" />

            <span className="col-start-2 flex min-w-0 items-center gap-1 text-body-sm leading-tight text-muted-foreground">
                {t('map.departures.departs')}
                <ExpectedTime departure={dep} timeZone={timeZone} />
                {platform && <><span aria-hidden="true">·</span><span className="whitespace-nowrap">{t('map.departures.platformCode', { code: platform })}</span></>}
            </span>
            <span className="justify-self-end"><Amenities departure={dep} /></span>

            <TripNotes departure={dep} mark={mark} className="col-span-2 col-start-2" />
        </Button>
    );
});

NextDepartureRow.displayName = 'NextDepartureRow';
