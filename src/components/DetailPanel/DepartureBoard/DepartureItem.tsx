import { memo, useMemo, useRef } from 'react';
import { Countdown } from './Countdown';
import { DelayDelta } from './DelayDelta';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DelayText } from '@/components/DelayText';
import { distinctLines, summarizeFeeders } from '@/domain/departures';
import type { Departure, DepartureFeeder, Continuation } from '@/types';
import { useTranslation } from 'react-i18next';
import { Accessibility, CornerDownRight, Hourglass, Snowflake, Train } from 'lucide-react';
import { LineBadge } from '@/components/LineBadge';
import { DEPARTURES_CONFIG } from '@/config/constants';
import { useInterchanges } from '@/hooks/derived/useInterchanges';
import { InterchangeBadges } from '@/components/InterchangeBadges';
import { IconTooltip } from '@/components/IconTooltip';
import { useRideStore } from '@/state/rideStore';
import { formatTimetableClock } from '@/domain/time';

interface DepartureItemProps {
    departure: Departure;
    /** The board's city zone, for the scheduled time. */
    timeZone: string;
    onDepartureClick: (tripId: string, vehicleId?: string, initialData?: Partial<Departure>) => void;
    /** When true, the headsign is already displayed in the group header, so we hide it here */
    hideHeadsign?: boolean;
    /** The trip the board was opened from; marked like the ridden trip. */
    isHighlighted?: boolean;
}

/**
 * DepartureItem
 *
 * Compact tabular row for a departure.
 * Layout: [Time / Delay] [Headsign? / Amenities + Hints] [Platform?] [Countdown]
 */
export const DepartureItem = memo(({
    departure: dep,
    timeZone,
    onDepartureClick,
    hideHeadsign,
    isHighlighted = false
}: DepartureItemProps) => {
    const { t } = useTranslation();
    const { forHeadsign } = useInterchanges();
    const clickStartPos = useRef<{ x: number, y: number } | null>(null);
    const isRiding = useRideStore(s => !!dep.tripId && s.ride?.tripId === dep.tripId);
    const isWatched = useRideStore(s => !!dep.tripId && s.followed?.tripId === dep.tripId);

    const isMarked = isHighlighted || isRiding || isWatched;

    const handlePointerDown = (e: React.PointerEvent) => {
        clickStartPos.current = { x: e.clientX, y: e.clientY };
    };

    const handleClick = (e: React.MouseEvent) => {
        if (!dep.tripId) return;

        // Enter or Space on a focused row clicks without a pointer.
        if (e.detail === 0) {
            onDepartureClick(dep.tripId, dep.vehicleId, dep);
            return;
        }

        if (clickStartPos.current) {
            const dx = e.clientX - clickStartPos.current.x;
            const dy = e.clientY - clickStartPos.current.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 10) {
                onDepartureClick(dep.tripId, dep.vehicleId, dep);
            }
        }
        clickStartPos.current = null;
    };

    const isTrain = dep.type === 'train';
    const isCanceled = dep.isCanceled;
    const hasDelay = typeof dep.delay === 'number' && dep.delay !== 0;
    const hasMeta = dep.is_wheelchair_accessible || dep.is_air_conditioned || !!dep.continues_as || (dep.connections?.length ?? 0) > 0;

    return (
        <Button
            variant="ghost"
            size="row"
            onPointerDown={handlePointerDown}
            onClick={handleClick}
            data-testid={`departure-item-${dep.tripId}`}
            className={cn(
                dep.tripId ? "hover:bg-muted/50" : "cursor-default",
                isMarked && "bg-primary/10 hover:bg-primary/15 shadow-[inset_3px_0_0_var(--color-primary)]"
            )}
        >
            <div className="flex flex-col shrink-0 w-12 gap-0.5">
                <span className={cn(
                    "text-muted-foreground text-sm font-medium leading-tight tabular-nums",
                    isCanceled && "line-through opacity-60"
                )}>
                    {formatTimetableClock(dep.scheduled, timeZone)}
                </span>
                {!isCanceled && hasDelay && (
                    <span className="flex gap-1 items-center">
                        <DelayText delay={dep.delay} className="text-xs leading-none" />
                        <DelayDelta
                            delta={dep.delayDelta || 0}
                            lastUpdate={dep.lastDelayUpdate}
                            isInline={true}
                        />
                    </span>
                )}
            </div>

            <div className="flex flex-col flex-1 min-w-0 gap-1">
                {isMarked && (
                    <span className="micro-label text-primary leading-none">{t(isRiding ? 'map.departures.yourTrip' : isWatched ? 'map.departures.watchedTrip' : 'map.departures.viewedTrip')}</span>
                )}
                {!hideHeadsign && (
                    <span className="flex items-center gap-2 min-w-0">
                        <span className={cn(
                            "text-foreground text-sm font-medium leading-tight truncate min-w-0",
                            isCanceled && "line-through text-muted-foreground"
                        )}>
                            {dep.headsign}
                        </span>
                        <InterchangeBadges codes={forHeadsign(dep.headsign, dep.line)} />
                    </span>
                )}
                {hasMeta && <span className={cn(
                    "flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0 text-muted-foreground",
                    isCanceled && "opacity-50"
                )}>
                    <span className="flex items-center gap-1 w-8 shrink-0">
                        {dep.is_wheelchair_accessible && (
                            <IconTooltip label={t('amenities.wheelchairAccessible')} className="opacity-60">
                                <Accessibility size={14} strokeWidth={1.5} aria-hidden="true" />
                            </IconTooltip>
                        )}
                        {dep.is_air_conditioned && (
                            <IconTooltip label={t('amenities.airConditioned')} className="opacity-60">
                                <Snowflake size={14} strokeWidth={1.5} aria-hidden="true" />
                            </IconTooltip>
                        )}
                    </span>
                    {dep.continues_as && <ContinuationHint continuation={dep.continues_as} />}
                    {dep.connections && dep.connections.length > 0 && (
                        <FeederHint feeders={dep.connections} />
                    )}
                </span>}
            </div>

            <div className="flex gap-2 shrink-0 items-center">
                {dep.platform && isTrain && (
                    <IconTooltip
                        label={t('map.departures.platform')}
                        className={cn("justify-center min-w-6 gap-1 px-1.5 py-0.5 bg-muted rounded-md border mr-1", isCanceled && "opacity-50")}
                    >
                        <Train size={12} className="opacity-50" aria-hidden="true" />
                        <span className="text-xs font-semibold text-muted-foreground leading-none tabular-nums">{dep.platform}</span>
                    </IconTooltip>
                )}

                {isCanceled ? (
                    <Badge variant="destructive" className="rounded-md font-semibold">
                        {t('map.departures.canceled')}
                    </Badge>
                ) : (
                    <span className="text-sm font-bold leading-none shrink-0 min-w-[48px] text-right tabular-nums">
                        <Countdown timestamp={dep.timestamp} />
                    </span>
                )}
            </div>
        </Button>
    );
});

DepartureItem.displayName = 'DepartureItem';

/** The line the vehicle continues as after this trip's last stop. */
const ContinuationHint = ({ continuation }: { continuation: Continuation }) => {
    const { t } = useTranslation();
    const label = t('map.departures.continuesAs', { line: continuation.line, headsign: continuation.headsign });

    return (
        <IconTooltip label={label} className="gap-1 text-muted-foreground">
            <CornerDownRight size={14} strokeWidth={1.5} className="opacity-60" aria-hidden="true" />
            <LineBadge name={continuation.line} routeColor={continuation.route_color ?? ''} size="sm" />
        </IconTooltip>
    );
};

/** The first trip this departure waits for, with the expected hold when the feeder is live. */
const FeederHint = ({ feeders }: { feeders: DepartureFeeder[] }) => {
    const { t } = useTranslation();

    const lines = useMemo(() => distinctLines(feeders).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })), [feeders]);
    const { missed, held, heldMinutes } = summarizeFeeders(feeders);
    const label = missed.length > 0
        ? t('map.departures.feeder.wontWait', { line: missed.join(', ') })
        : held
            ? t('map.departures.feeder.heldFor', { line: held.line, minutes: heldMinutes })
            : t('map.departures.feeder.waitsForLines', { lines: lines.map(([name]) => name).join(', ') });

    const visible = lines.slice(0, DEPARTURES_CONFIG.MAX_FEEDER_BADGES);
    const hiddenCount = lines.length - visible.length;

    return (
        <IconTooltip
            label={label}
            className={cn(
                "gap-1 text-[10px] font-semibold tabular-nums",
                missed.length > 0 ? "text-destructive" : "text-muted-foreground"
            )}
        >
            <Hourglass size={14} strokeWidth={1.5} className="shrink-0 opacity-60" aria-hidden="true" />
            {visible.map(([name, color]) => (
                <LineBadge key={name} name={name} routeColor={color} size="sm" className="opacity-70" />
            ))}
            {hiddenCount > 0 && <span aria-hidden="true">+{hiddenCount}</span>}
            {held && <span aria-hidden="true">~{heldMinutes} min</span>}
        </IconTooltip>
    );
};
