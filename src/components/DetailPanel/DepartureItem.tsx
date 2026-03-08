import { format, parseISO, type Locale } from 'date-fns';
import { Countdown } from '../Countdown';
import { DelayDelta } from './DelayDelta';
import { cn } from '@/lib/utils';
import { getCatchStatus } from '../../utils/transitLogic';
import { formatDelay } from '../../utils/dateUtils';
import type { Departure } from '../../types/transit';
import { useTranslation } from 'react-i18next';
import { Box, Stack, HStack } from '@/components/ui/layout';

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

    return (
        <button
            onClick={() => dep.tripId && onDepartureClick(dep.tripId, dep.vehicleId, dep)}
            className={cn(
                "flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-border transition-all w-full text-left outline-none",
                dep.tripId ? "hover:bg-muted/50 hover:border-border/80 cursor-pointer active:scale-[0.98]" : "cursor-default"
            )}
        >
            <HStack className="gap-4">
                <Stack className="gap-0">
                    <div className="text-foreground font-semibold leading-tight">{dep.headsign}</div>
                    <HStack className="text-muted-foreground text-[10px] mt-1 gap-2">
                        <span className="tabular-nums">
                            {format(parseISO(dep.scheduled), 'HH:mm', { locale })}
                        </span>
                        {isTrainStop && dep.platform && (
                            <span className="bg-muted px-1.5 py-0.5 rounded text-foreground font-bold tracking-wider border border-border">
                                {dep.platform}
                            </span>
                        )}
                        <HStack className="gap-1">
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

            <Stack className="items-end justify-center min-w-[100px] gap-0">
                <Box className="text-lg font-bold text-emerald-400 tabular-nums leading-none">
                    <Countdown timestamp={dep.timestamp} />
                </Box>
                {stopDistanceInfo?.showCatchIndicator && catchStatus && (
                    <Box className="mt-2">
                        <HStack className={cn(
                            "px-1.5 py-0.5 rounded-md gap-1 text-[10px] font-bold whitespace-nowrap",
                            catchStatus.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                            catchStatus.status === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                            'bg-rose-500/10 text-rose-400'
                        )}>
                            <span className="text-[8px] leading-none">
                                {catchStatus.status === 'success' ? '🟢' :
                                    catchStatus.status === 'warning' ? '🟡' : '🔴'}
                            </span>
                            <span className="uppercase tracking-tighter">
                                {t(`map.departures.catchStatusCompact.${catchStatus.status}`)}
                            </span>
                        </HStack>
                    </Box>
                )}
            </Stack>
        </button>
    );
};
