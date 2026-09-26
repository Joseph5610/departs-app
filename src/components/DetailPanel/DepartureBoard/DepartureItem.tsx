import { memo, useMemo, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { Countdown } from './Countdown';
import { DelayDelta } from './DelayDelta';
import { cn } from '@/lib/utils';
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
import { useMetroLines } from '@/hooks/derived/useMetroLines';

interface DepartureItemProps {
    departure: Departure;
    onDepartureClick: (tripId: string, vehicleId?: string, initialData?: Partial<Departure>) => void;
    /** When true, the headsign is already displayed in the group header, so we hide it here */
    hideHeadsign?: boolean;
}

/**
 * DepartureItem
 *
 * Compact, single-line tabular row for a departure.
 * Layout: [Time] [Icons] [Headsign?] [Delay + Delta] [Platform?] [Countdown]
 */
export const DepartureItem = memo(({
    departure: dep,
    onDepartureClick,
    hideHeadsign
}: DepartureItemProps) => {
    const { t } = useTranslation();
    const { forHeadsign } = useMetroLines();
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

    return (
        <Button
            variant="ghost"
            onPointerDown={handlePointerDown}
            onClick={handleClick}
            data-testid={`departure-item-${dep.tripId}`}
            className={cn(
                "w-full h-auto flex items-center justify-start gap-3 py-3 px-4 rounded-none font-normal text-left transition-colors",
                dep.tripId
                    ? "hover:bg-muted/50 cursor-pointer"
                    : "cursor-default",
                "focus-visible:outline-none focus-visible:bg-muted/50"
            )}
        >
            {/* Time + Delay Block */}
            <div className="flex gap-2 shrink-0 w-[85px] items-baseline">
                <span className={cn(
                    "text-muted-foreground text-sm font-medium tabular-nums",
                    isCanceled && "line-through opacity-60"
                )}>
                    {format(parseISO(dep.scheduled), 'HH:mm')}
                </span>
                {!isCanceled && <div className="flex gap-1 items-center">
                    {typeof dep.delay === 'number' && dep.delay !== 0 && (
                        <span className={cn(
                            "text-xs font-bold tabular-nums",
                            dep.delay > 0 ? "text-destructive" : "text-sky-500"
                        )}>
                            {formatDelay(dep.delay)}
                        </span>
                    )}
                    <DelayDelta
                        delta={dep.delayDelta || 0}
                        lastUpdate={dep.lastDelayUpdate}
                        isInline={true}
                    />
                </div>}
            </div>

            {/* Icons Block - before headsign like official PID tables */}
            <div className={cn("flex gap-1.5 opacity-40 items-center shrink-0 w-10 ml-1", isCanceled && "opacity-20")}>
                {dep.is_wheelchair_accessible && (
                    <Accessibility size={16} strokeWidth={1.5}  />
                )}
                {dep.is_air_conditioned && (
                    <Snowflake size={16} strokeWidth={1.5}  />
                )}
            </div>

            {dep.continues_as && <ContinuationHint continuation={dep.continues_as} />}
            {dep.connections && dep.connections.length > 0 && (
                <FeederHint feeders={dep.connections} />
            )}

            {/* Headsign (shown when not redundant with group header) */}
            {!hideHeadsign && (
                <span className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={cn(
                        "text-foreground text-sm font-medium leading-tight truncate min-w-0",
                        isCanceled && "line-through text-muted-foreground"
                    )}>
                        {dep.headsign}
                    </span>
                    {forHeadsign(dep.headsign, dep.line).map((line) => (
                        <LineBadge key={line.name} name={line.name} routeColor={line.route_color} />
                    ))}
                </span>
            )}
            {/* Spacer when headsign is hidden */}
            {hideHeadsign && <div className="flex-1 min-w-0" />}

            {/* Right Side Info Block */}
            <div className="flex gap-2 shrink-0 items-center">
                {/* Platform Badge (trains only, metro is handled in group header) */}
                {dep.platform && isTrain && (
                    <div 
                        className={cn("flex items-center justify-center shrink-0 min-w-[24px] gap-1 px-1.5 py-0.5 bg-muted rounded-md border mr-1", isCanceled && "opacity-50")}
                        title={t('map.departures.platform')}
                    >
                        <Train size={12} className="opacity-50"  />
                        <span className="text-xs font-semibold text-muted-foreground leading-none tabular-nums">{dep.platform}</span>
                    </div>
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
        <span title={label} className="flex items-center gap-1 shrink-0 text-muted-foreground">
            <span className="sr-only">{label}</span>
            <CornerDownRight size={12} strokeWidth={2} aria-hidden="true" />
            <LineBadge name={continuation.line} routeColor={continuation.route_color ?? ''} size="sm" />
        </span>
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

    const showBadges = lines.length <= DEPARTURES_CONFIG.MAX_FEEDER_BADGES;

    return (
        <span
            title={label}
            className={cn(
                "flex items-center gap-1 min-w-0 text-[10px] font-semibold tabular-nums",
                showBadges ? "shrink-0" : "shrink",
                missed.length > 0 ? "text-destructive" : "text-muted-foreground"
            )}
        >
            <span className="sr-only">{label}</span>
            <Hourglass size={12} strokeWidth={2} className="shrink-0" aria-hidden="true" />
            {showBadges
                ? lines.map(([name, color]) => (
                    <LineBadge key={name} name={name} routeColor={color} size="sm" className="opacity-70" />
                ))
                : <span className="truncate" aria-hidden="true">{t('map.departures.feeder.waitsForMany')}</span>}
            {held && <span aria-hidden="true">~{heldMinutes} min</span>}
        </span>
    );
};
