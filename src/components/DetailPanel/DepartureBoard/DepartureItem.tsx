import { memo, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { Countdown } from './Countdown';
import { DelayDelta } from './DelayDelta';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { formatDelay } from '../../../utils/dateUtils';
import type { Departure } from '../../../types/transit';
import { useTranslation } from 'react-i18next';
import { Accessibility, Snowflake, Train } from 'lucide-react';
import { LineBadge } from '../../LineBadge';

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

    const isTrain = dep.type === '2' || dep.type === 'train';

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
                <span className="text-muted-foreground text-sm tabular-nums font-medium">
                    {format(parseISO(dep.scheduled), 'HH:mm')}
                </span>
                <div className="flex gap-1 items-center">
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
                </div>
            </div>

            {/* Icons Block - before headsign like official PID tables */}
            <div className="flex gap-1.5 opacity-40 items-center shrink-0 min-w-[32px] ml-1">
                {dep.is_wheelchair_accessible && (
                    <Accessibility size={16} strokeWidth={1.5}  />
                )}
                {dep.is_air_conditioned && (
                    <Snowflake size={16} strokeWidth={1.5}  />
                )}
            </div>

            {/* Headsign (shown when not redundant with group header) */}
            {!hideHeadsign && (
                <span className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-foreground text-sm font-medium leading-tight truncate min-w-0">
                        {dep.headsign}
                    </span>
                    {dep.headsign_metro_lines?.map((line) => (
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
                        className="flex items-center justify-center shrink-0 min-w-[24px] gap-1 px-1.5 py-0.5 bg-muted rounded-md border mr-1"
                        title={t('map.departures.platform')}
                    >
                        <Train size={12} className="opacity-50"  />
                        <span className="text-xs font-semibold text-muted-foreground leading-none">{dep.platform}</span>
                    </div>
                )}

                {/* Countdown */}
                <span className="text-sm font-bold tabular-nums leading-none shrink-0 min-w-[48px] text-right">
                    <Countdown timestamp={dep.timestamp} />
                </span>
            </div>
        </Button>
    );
});

DepartureItem.displayName = 'DepartureItem';
