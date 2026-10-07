import { useTranslation } from 'react-i18next';
import { cn } from 'cn';
import { calculateTimeDifferenceSecs, formatClock } from '@/domain/time';
import { getDelayStatus } from '@/domain/delay';

/** Right-aligned time column: the expected time, coloured by delay, over the scheduled one when they differ. */
export const TimelineTime = ({ realtimeTime, scheduledTime, hasRealtime, isPast = false }: {
    realtimeTime?: string;
    scheduledTime?: string;
    hasRealtime: boolean;
    isPast?: boolean;
}) => {
    const { t } = useTranslation();
    const isLate = hasRealtime && !!realtimeTime && !!scheduledTime
        && getDelayStatus(calculateTimeDifferenceSecs(realtimeTime, scheduledTime)) === 'late';

    return (
        <span className="flex flex-col items-end shrink-0 min-w-17">
            <span className={cn(
                "text-xs tabular-nums",
                isPast ? "text-muted-foreground" : hasRealtime ? (isLate ? "text-destructive" : "text-primary") : "text-muted-foreground"
            )}>
                {formatClock(realtimeTime, true)}
            </span>
            {hasRealtime && (
                <span className="text-[9px] text-muted-foreground tabular-nums">
                    {t('map.vehicleDetails.scheduledTime')} {formatClock(scheduledTime, true)}
                </span>
            )}
        </span>
    );
};
