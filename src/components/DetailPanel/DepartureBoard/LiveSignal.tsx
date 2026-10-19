import { cn } from '@/lib/cn';
import type { LiveStatus } from '@/domain/departures';
import { SignalMark } from '@/components/SignalMark';

const LIVE_COLOR: Partial<Record<LiveStatus, string>> = {
    onTime: 'text-emerald-600 dark:text-emerald-400',
    late: 'text-destructive',
    early: 'text-sky-500',
};

/**
 * The live state of a departure as a broadcast mark, coloured by its delay; timetable-only and cancelled
 * departures get none, so the mark itself says the time is live.
 */
export const LiveSignal = ({ status, className }: { status: LiveStatus; className?: string }) => {
    const color = LIVE_COLOR[status];
    if (!color) return null;
    return <SignalMark className={cn(color, className)} />;
};
