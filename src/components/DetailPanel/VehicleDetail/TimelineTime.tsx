import { calculateTimeDifferenceSecs, formatClock } from '@/domain/time';
import { getDelayStatus } from '@/domain/delay';
import { cn } from '@/lib/cn';

/** Right-aligned time column: the expected time coloured by delay, beside the struck timetable time once live data moves it. */
export const TimelineTime = ({ realtimeTime, scheduledTime, hasRealtime, isPast = false }: {
    realtimeTime?: string;
    scheduledTime?: string;
    hasRealtime: boolean;
    isPast?: boolean;
}) => {
    const scheduled = formatClock(scheduledTime ?? realtimeTime);
    const expected = hasRealtime ? formatClock(realtimeTime) : null;
    const isLate = hasRealtime && !!realtimeTime && !!scheduledTime
        && getDelayStatus(calculateTimeDifferenceSecs(realtimeTime, scheduledTime)) === 'late';
    const color = isPast ? "text-muted-foreground" : hasRealtime ? (isLate ? "text-destructive" : "text-primary") : "text-muted-foreground";

    if (!expected || expected === scheduled) {
        return <span className={cn("shrink-0 text-body-sm tabular-nums", color)}>{scheduled}</span>;
    }
    return (
        <span className="inline-flex shrink-0 items-baseline justify-end gap-1.5 text-body-sm tabular-nums">
            <span className="text-muted-foreground line-through opacity-60">{scheduled}</span>
            <span className={cn("font-medium", color)}>{expected}</span>
        </span>
    );
};
