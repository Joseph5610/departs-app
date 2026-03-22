import { useRef } from 'react';
import { format, parseISO, type Locale } from 'date-fns';
import { Countdown } from '../Countdown';
import { DelayDelta } from './DelayDelta';
import { cn } from '@/lib/utils';
import { getCatchStatus } from '../../utils/transitLogic';
import { formatDelay } from '../../utils/dateUtils';
import { getVehicleColor } from '../../utils/vehicleColors';
import type { Departure } from '../../types/transit';
import { useTranslation } from 'react-i18next';
import { Box, Stack, HStack, Surface } from '@/components/ui/layout';

interface DepartureItemProps {
    departure: Departure;
    onDepartureClick: (tripId: string, vehicleId?: string, initialData?: Partial<Departure>) => void;
    stopDistanceInfo: {
        distance: number;
        time: number;
        isAtStop: boolean;
        showCatchIndicator: boolean;
    } | null;
    isTrainStop?: boolean;
    locale: Locale;
}

/**
 * DepartureItem
 *
 * Re-architected with semantic components. Internalizes layout classes.
 */
export const DepartureItem = ({
    departure,
    onDepartureClick,
    stopDistanceInfo,
    isTrainStop,
    locale
}: DepartureItemProps) => {
    const { t } = useTranslation();
    const dep = departure;

    const catchStatus = stopDistanceInfo
        ? getCatchStatus(stopDistanceInfo.distance, dep.timestamp, stopDistanceInfo.isAtStop)
        : null;

    const clickStartPos = useRef<{ x: number; y: number } | null>(null);

    const handlePointerDown = (e: React.PointerEvent) => {
        clickStartPos.current = { x: e.clientX, y: e.clientY };
    };

    const handleClick = (e: React.MouseEvent) => {
        if (!clickStartPos.current) return;
        
        const dx = Math.abs(e.clientX - clickStartPos.current.x);
        const dy = Math.abs(e.clientY - clickStartPos.current.y);
        const threshold = 5; // 5px threshold

        if (dx < threshold && dy < threshold) {
            if (dep.tripId) {
                onDepartureClick(dep.tripId, dep.vehicleId, dep);
            }
        }
        clickStartPos.current = null;
    };

    const lineColor = getVehicleColor(dep.type, dep.line);

    return (
        <Surface
            asChild
            variant="tinted"
            padding="none"
            className={cn(
                "transition-all w-full text-left focus-visible:ring-2 focus-visible:ring-ring border-white/15! rounded-2xl relative overflow-hidden group/item",
                dep.tripId ? "hover:bg-white/10 hover:border-white/20 cursor-pointer active:scale-[0.98]" : "cursor-default"
            )}
        >
            <button
                onPointerDown={handlePointerDown}
                onClick={handleClick}
                className="flex items-center justify-between px-5 py-4 relative z-10"
            >
                {/* Subtle background color bleed */}
                <Box
                    className="absolute inset-0 opacity-[0.03] group-hover/item:opacity-[0.06] transition-opacity pointer-events-none"
                    style={{ backgroundColor: lineColor }}
                />

                <HStack gap={4} className="min-w-0 flex-1">
                    <Stack gap={1} className="min-w-0 flex-1">
                        <div className="text-foreground font-bold text-[15px] leading-tight truncate tracking-tight">
                            {dep.headsign}
                        </div>
                        <HStack gap={3} align="center" className="text-muted-foreground/80 text-[10px]">
                            <HStack gap={1} align="center">
                                <span className="font-bold tabular-nums">
                                    {format(parseISO(dep.scheduled), 'HH:mm', { locale })}
                                </span>
                            </HStack>

                            {isTrainStop && dep.platform && (
                                <Box className="h-4 px-1.5 flex items-center bg-white/5 rounded text-[9px] font-bold tracking-widest text-muted-foreground border border-white/10">
                                    {dep.platform}
                                </Box>
                            )}

                            <HStack gap={2} align="center">
                                {typeof dep.delay === 'number' && dep.delay !== 0 && (
                                    <span className={cn(
                                        "font-bold tabular-nums tracking-wide",
                                        dep.delay > 0 ? "text-rose-400" : "text-sky-400"
                                    )}>
                                        {formatDelay(dep.delay)}
                                    </span>
                                )}
                                <DelayDelta
                                    delta={dep.delayDelta || 0}
                                    lastUpdate={dep.lastDelayUpdate}
                                    isInline={typeof dep.delay === 'number' && dep.delay !== 0}
                                />
                            </HStack>
                        </HStack>
                    </Stack>
                </HStack>

                <Stack gap={2} align="end" justify="center" className="shrink-0 pl-4 border-l border-white/5">
                    <Box className="text-xl font-black text-primary tabular-nums leading-none tracking-tighter drop-shadow-[0_0_8px_var(--color-primary)]">
                        <Countdown timestamp={dep.timestamp} />
                    </Box>

                    {stopDistanceInfo?.showCatchIndicator && catchStatus && (
                        <HStack
                            gap={2}
                            align="center"
                            className={cn(
                                "px-1.5 py-0.5 rounded-md border text-[9px] font-bold uppercase tracking-wider",
                                catchStatus.status === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                                catchStatus.status === 'warning' ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                                "bg-rose-500/10 border-rose-500/20 text-rose-400"
                            )}
                        >
                            <Box className={cn(
                                "w-1 h-1 rounded-full",
                                catchStatus.status === 'success' ? "bg-emerald-400 shadow-[0_0_4px_var(--color-emerald-400)]" :
                                catchStatus.status === 'warning' ? "bg-amber-400 shadow-[0_0_4px_var(--color-amber-400)]" :
                                "bg-rose-400 shadow-[0_0_4px_var(--color-rose-400)]"
                            )} />
                            <span>{t(`map.departures.catchStatusCompact.${catchStatus.status}`)}</span>
                        </HStack>
                    )}
                </Stack>
            </button>
        </Surface>
    );
};
