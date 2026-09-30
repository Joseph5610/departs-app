import { memo, useMemo, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { Countdown } from './Countdown';
import { DelayDelta } from './DelayDelta';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDelay } from '../../../utils/dateUtils';
import type { Departure } from '../../../types/transit';
import type { DepartureFeeder } from '../../../types/departures';
import type { Continuation } from '../../../types/vehicles';
import { useTranslation } from 'react-i18next';
import { Accessibility, CornerDownRight, Hourglass, Snowflake, Train } from 'lucide-react';
import { LineBadge } from '../../LineBadge';
import { DEPARTURES_CONFIG } from '@/config/constants';
import { useInterchanges } from '@/hooks/derived/useInterchanges';
import { InterchangeBadges } from '../../InterchangeBadges';
import { IconTooltip } from '../../IconTooltip';

interface DepartureItemProps {
    departure: Departure;
    onDepartureClick: (tripId: string, vehicleId?: string, initialData?: Partial<Departure>) => void;
    /** When true, the headsign is already displayed in the group header, so we hide it here */
    hideHeadsign?: boolean;
}

/**
 * DepartureItem
 *
 * Compact tabular row for a departure.
 * Layout: [Time / Delay] [Headsign? / Amenities + Hints] [Platform?] [Countdown]
 */
export const DepartureItem = memo(({
    departure: dep,
    onDepartureClick,
    hideHeadsign
}: DepartureItemProps) => {
    const { t } = useTranslation();
    const { forHeadsign } = useInterchanges();
    const clickStartPos = useRef<{ x: number, y: number } | null>(null);

    const handlePointerDown = (e: React.PointerEvent) => {
        clickStartPos.current = { x: e.clientX, y: e.clientY };
    };

    const handleClick = (e: React.MouseEvent) => {
        if (!dep.tripId) return;
        
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
            onPointerDown={handlePointerDown}
            onClick={handleClick}
            data-testid={`departure-item-${dep.tripId}`}
            className={cn(
                "w-full h-auto min-h-13 flex items-center justify-start gap-3 py-2.5 px-4 rounded-none font-normal text-left transition-colors",
                dep.tripId
                    ? "hover:bg-muted/50 cursor-pointer"
                    : "cursor-default",
                "focus-visible:outline-none focus-visible:bg-muted/50"
            )}
        >
            <div className="flex flex-col shrink-0 w-12 gap-0.5">
                <span className={cn(
                    "text-muted-foreground text-sm font-medium leading-tight tabular-nums",
                    isCanceled && "line-through opacity-60"
                )}>
                    {format(parseISO(dep.scheduled), 'HH:mm')}
                </span>
                {!isCanceled && hasDelay && (
                    <span className="flex gap-1 items-center">
                        <span className={cn(
                            "text-xs font-bold leading-none tabular-nums",
                            (dep.delay ?? 0) > 0 ? "text-destructive" : "text-sky-500"
                        )}>
                            {formatDelay(dep.delay ?? 0)}
                        </span>
                        <DelayDelta
                            delta={dep.delayDelta || 0}
                            lastUpdate={dep.lastDelayUpdate}
                            isInline={true}
                        />
                    </span>
                )}
            </div>

            <div className="flex flex-col flex-1 min-w-0 gap-1">
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

            {/* Right Side Info Block */}
            <div className="flex gap-2 shrink-0 items-center">
                {/* Platform Badge (trains only, metro is handled in group header) */}
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

    const lines = useMemo(() => {
        const byName = new Map<string, string>();
        for (const f of feeders) if (!byName.has(f.line)) byName.set(f.line, f.route_color ?? '');
        return [...byName].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
    }, [feeders]);

    let missed: string[] = [];
    let held: DepartureFeeder | null = null;
    for (const f of feeders) {
        if (f.will_miss) missed = [...missed, f.line];
        else if (f.hold_s !== null && f.hold_s >= 60 && (!held || f.hold_s > (held.hold_s ?? 0))) held = f;
    }
    const heldMinutes = held ? Math.round((held.hold_s ?? 0) / 60) : 0;
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
