import type React from 'react';
import { BellRing } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useMyTripEntry } from '@/hooks/features/useMyTripEntry';
import type { Departure } from '@/types';

// Only the tap is the bell's: a press stays the row's, so a swipe that starts on the bell (a finger snapped to it) still swipes.
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/** The bell after a departure's time: "I'm taking this trip", opening its My trip sheet; filled in colour once taken. */
export const MyTripBell = ({ departure, onlyWhenSet = false }: {
    departure: Departure;
    /** Shown only on a trip the user takes, e.g. on later departures, where a bell on every row would be noise. */
    onlyWhenSet?: boolean;
}) => {
    const remind = useMyTripEntry(departure);
    if (!remind || (onlyWhenSet && !remind.isSet)) return null;
    return (
        <button
            type="button"
            onClick={(e) => { stop(e); remind.open(); }}
            onKeyDown={stop}
            aria-label={remind.label}
            data-testid="my-trip-bell"
            title={remind.label}
            className={cn(
                "-my-0.5 ml-1 inline-grid size-6 shrink-0 cursor-pointer place-items-center rounded-full outline-none transition-colors hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-primary/50",
                remind.isSet ? "text-primary" : "text-muted-foreground/60 hover:text-foreground"
            )}
        >
            <BellRing strokeWidth={remind.isSet ? 2.25 : 1.75} fill={remind.isSet ? 'currentColor' : 'none'} className="size-3.5" />
        </button>
    );
};
