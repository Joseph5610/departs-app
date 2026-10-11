import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { DEPARTURES_CONFIG, UI_TIMING_MS } from '@/config/constants';
import { departureClock, liveStatus } from '@/domain/departures';
import { formatTimetableClock, minutesCountdown } from '@/domain/time';
import { useNowEvery } from '@/hooks/useNow';
import { useTripMark } from '@/hooks/derived/useTripMark';
import { useDepartureTap } from '@/hooks/features/useTapClick';
import type { Departure, DepartureClickHandler } from '@/types';
import { LiveSignal } from './LiveSignal';
import { useLiveStatusLabel } from '@/hooks/derived/useLiveStatusLabel';
import { ButtonTooltip } from '@/components/ButtonTooltip';

interface DepartureChipProps {
    departure: Departure;
    timeZone: string;
    isHighlighted: boolean;
    onDepartureClick: DepartureClickHandler;
}

/** A later departure of a direction: minutes away below an hour, then its clock time, with its live state. */
export const DepartureChip = memo(({ departure: dep, timeZone, isHighlighted, onDepartureClick }: DepartureChipProps) => {
    const { t } = useTranslation();
    const now = useNowEvery(UI_TIMING_MS.MINUTES_TICK);
    const mark = useTripMark(dep.tripId, isHighlighted);
    const tap = useDepartureTap(dep, onDepartureClick);
    const statusLabel = useLiveStatusLabel(dep);
    const countdown = minutesCountdown(dep.timestamp, now, DEPARTURES_CONFIG.COUNTDOWN_MINUTES_LIMIT);
    const label = countdown.kind === 'now'
        ? t('map.departures.now')
        : countdown.kind === 'minutes'
            ? t('map.departures.minutes', { count: countdown.minutes })
            : formatTimetableClock(dep.timestamp, timeZone);

    const { scheduled, expected } = departureClock(dep, timeZone);
    const departs = t('map.departures.departsAt', { time: expected ?? scheduled });
    const tooltip = dep.isCanceled ? `${departs} · ${t('map.departures.canceled')}` : statusLabel ? `${departs} · ${statusLabel}` : departs;

    return (
        <ButtonTooltip label={tooltip}>
        <Button
            variant="ghost"
            {...tap}
            data-testid={`departure-item-${dep.tripId}`}
            aria-label={`${label}, ${tooltip}`}
            className={cn(
                "h-7 gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 text-body-sm font-semibold tabular-nums text-muted-foreground hover:bg-foreground/12 hover:text-foreground",
                dep.isCanceled && "line-through opacity-60",
                mark && "bg-primary/15 text-foreground ring-1 ring-primary/60"
            )}
        >
            <LiveSignal status={liveStatus(dep)} className="size-2.5" />
            {label}
        </Button>
        </ButtonTooltip>
    );
});

DepartureChip.displayName = 'DepartureChip';
