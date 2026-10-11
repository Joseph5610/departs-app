import { cn } from '@/lib/cn';

interface StruckTimeProps {
    /** The timetable time, e.g. "16:26". */
    scheduled: string;
    /** The expected time when live data moves it to another minute; the timetable time is struck through beside it. */
    expected: string | null;
    isCanceled?: boolean;
    className?: string;
}

/** A timetable time, struck through with the expected time beside it once live data moves it, as on the departure board. */
export const StruckTime = ({ scheduled, expected, isCanceled = false, className }: StruckTimeProps) => {
    if (!expected) return <span className={cn("tabular-nums", isCanceled && "line-through", className)}>{scheduled}</span>;
    return (
        <span className={cn("inline-flex items-baseline gap-1.5 tabular-nums", className)}>
            <span className="line-through opacity-60">{scheduled}</span>
            <span className="font-medium text-foreground">{expected}</span>
        </span>
    );
};
