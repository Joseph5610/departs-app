import { memo, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { Countdown } from './Countdown';
import { DelayDelta } from './DelayDelta';
import { cn } from '@/lib/utils';
import { formatDelay } from '../../../utils/dateUtils';
import type { Departure } from '../../../types/transit';
import { useTranslation } from 'react-i18next';
import { HStack } from '@/components/ui/layout';
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
        <button
            onPointerDown={handlePointerDown}
            onClick={handleClick}
            className={cn(
                "w-full flex items-center gap-2 py-2.5 px-3 text-left transition-colors",
                dep.tripId
                    ? "hover:bg-white/6 cursor-pointer active:bg-white/10"
                    : "cursor-default",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
            )}
        >
            {/* Time + Delay Block */}
            <HStack gap={1.5} className="shrink-0 w-[82px] items-baseline">
                <span className="text-muted-foreground text-[12.5px] tabular-nums font-medium">
                    {format(parseISO(dep.scheduled), 'HH:mm')}
                </span>
                <HStack gap={0.5} className="items-center">
                    {typeof dep.delay === 'number' && dep.delay !== 0 && (
                        <span className={cn(
                            "text-[10px] font-bold tabular-nums",
                            dep.delay > 0 ? "text-rose-400" : "text-sky-400"
                        )}>
                            {formatDelay(dep.delay)}
                        </span>
                    )}
                    <DelayDelta
                        delta={dep.delayDelta || 0}
                        lastUpdate={dep.lastDelayUpdate}
                        isInline={true}
                    />
                </HStack>
            </HStack>

            {/* Icons Block - before headsign like official PID tables */}
            <div className="flex gap-1.5 opacity-25 items-center min-h-[14px] shrink-0 min-w-[32px] ml-3">
                {dep.is_wheelchair_accessible && (
                    <Accessibility size={13} strokeWidth={2.5} />
                )}
                {dep.is_air_conditioned && (
                    <Snowflake size={13} strokeWidth={2.5} />
                )}
            </div>

            {/* Headsign (shown when not redundant with group header) */}
            {!hideHeadsign && (
                <span className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="text-foreground text-[14px] font-medium leading-tight truncate min-w-0">
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
            <HStack gap={1.5} className="shrink-0 items-center">
                {/* Platform Badge (trains only, metro is handled in group header) */}
                {dep.platform && isTrain && (
                    <div 
                        className="flex items-center justify-center shrink-0 min-w-[24px] gap-1 px-1.5 h-[16px] bg-white/8 rounded-[3px] border border-white/5 shadow-sm mr-1"
                        title={t('map.departures.platform')}
                    >
                        <Train size={9} strokeWidth={2.5} className="opacity-40" />
                        <span className="text-[9.5px] font-bold text-foreground/60 leading-none">{dep.platform}</span>
                    </div>
                )}

                {/* Countdown */}
                <span className="text-[14px] font-bold tabular-nums leading-none shrink-0 min-w-[48px] text-right">
                    <Countdown timestamp={dep.timestamp} />
                </span>
            </HStack>
        </button>
    );
});

DepartureItem.displayName = 'DepartureItem';
