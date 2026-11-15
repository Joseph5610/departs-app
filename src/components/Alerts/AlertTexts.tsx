import type React from 'react';
import { CalendarClock } from 'lucide-react';
import { cn } from '@/lib/cn';

/** A disruption's or notice's own text, alike in the alerts list and on a board. */
export const AlertText = ({ className, children }: { className?: string; children: React.ReactNode }) => (
    <div className={cn("type-row font-semibold leading-tight text-foreground/95 whitespace-pre-line", className)}>{children}</div>
);

/** When a disruption or notice applies: a calendar and the dates as a plain note under its text. */
export const ValidityLine = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center gap-1.5 type-note tabular-nums text-muted-foreground">
        <CalendarClock size={12} strokeWidth={2} className="shrink-0" />
        <span className="min-w-0">{children}</span>
    </div>
);
