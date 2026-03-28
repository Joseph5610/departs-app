import { useRef } from 'react';
import { Train } from 'lucide-react';
import { format, parseISO, type Locale } from 'date-fns';
import { Countdown } from './Countdown';
import { DelayDelta } from './DelayDelta';
import { cn } from '@/lib/utils';
import { getCatchStatus } from '../../../utils/transitUtils';
import { formatDelay } from '../../../utils/dateUtils';
import type { Departure } from '../../../types/transit';
import { useTranslation } from 'react-i18next';
import { Box, Stack, HStack, Surface } from '@/components/ui/layout';
import { Badge } from '@/components/ui/badge';

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

    return (
        <Surface
            asChild
            variant="tinted"
            padding="md"
            className={cn(
                "transition-all w-full text-left focus-visible:ring-2 focus-visible:ring-ring rounded-2xl",
                dep.tripId ? "hover:bg-white/10 cursor-pointer active:scale-[0.98]" : "cursor-default"
            )}
        >
            <button
                onPointerDown={handlePointerDown}
                onClick={handleClick}
                className="flex items-center justify-between"
            >
            <HStack gap={4}>
                <Stack gap={0}>
                    <div className="text-foreground font-semibold leading-tight">{dep.headsign}</div>
                    <HStack gap={2} className="text-muted-foreground text-[10px] mt-1">
                        <span className="tabular-nums">
                            {format(parseISO(dep.scheduled), 'HH:mm', { locale })}
                        </span>
                        {isTrainStop && dep.platform && (
                            <Badge
                                variant="outline"
                                className="h-5 px-2 rounded-lg text-[10px] font-bold tracking-wider flex items-center gap-1.5 bg-foreground/5 border-foreground/10! text-foreground"
                                title={t('search.platform', { code: dep.platform })}
                            >
                                <Train size={12} strokeWidth={2.5} className="shrink-0 opacity-60" />
                                <span className="tabular-nums">{dep.platform}</span>
                            </Badge>
                        )}
                        <HStack gap={1}>
                            {typeof dep.delay === 'number' && dep.delay !== 0 && (
                                <span className={cn(
                                    "font-bold tabular-nums",
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

            <Stack gap={0} align="end" justify="center" className="min-w-[100px]">
                <Box className="text-lg font-bold text-emerald-400 tabular-nums leading-none">
                    <Countdown timestamp={dep.timestamp} />
                </Box>
                {stopDistanceInfo?.showCatchIndicator && catchStatus && (
                    <Box className="mt-2">
                        <Badge
                            variant={
                                catchStatus.status === 'success' ? 'success' :
                                catchStatus.status === 'warning' ? 'warning' : 'danger'
                            }
                            className="px-1.5 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap gap-1"
                        >
                            <span className="text-[8px] leading-none">
                                {catchStatus.status === 'success' ? '🟢' :
                                    catchStatus.status === 'warning' ? '🟡' : '🔴'}
                            </span>
                            <span className="uppercase tracking-tighter">
                                {t(`map.departures.catchStatusCompact.${catchStatus.status}`)}
                            </span>
                        </Badge>
                    </Box>
                )}
            </Stack>
            </button>
        </Surface>
    );
};
