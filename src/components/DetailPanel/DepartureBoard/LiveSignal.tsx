import { cn } from '@/lib/cn';
import type { LiveStatus } from '@/domain/departures';

const LIVE_COLOR: Partial<Record<LiveStatus, string>> = {
    onTime: 'text-emerald-600 dark:text-emerald-400',
    late: 'text-destructive',
    early: 'text-sky-500',
};

/**
 * The live state of a departure as a "broadcast" mark (a dot with two arcs), coloured by its delay;
 * timetable-only and cancelled departures get none, so the mark itself says the time is live.
 */
export const LiveSignal = ({ status, className }: { status: LiveStatus; className?: string }) => {
    const color = LIVE_COLOR[status];
    if (!color) return null;
    return (
        <svg viewBox="0 0 16 16" aria-hidden="true" className={cn('size-3 shrink-0', color, className)}>
            <circle cx="3.5" cy="12.5" r="2" fill="currentColor" />
            <path d="M2 7.5a6.5 6.5 0 0 1 6.5 6.5M2 2.5a11.5 11.5 0 0 1 11.5 11.5" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
        </svg>
    );
};
