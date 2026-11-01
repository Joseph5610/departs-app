import type React from 'react';
import { useTranslation } from 'react-i18next';
import { Route } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useMyTripEntry } from '@/hooks/features/useMyTripEntry';
import type { Departure } from '@/types';

// Only the tap is the chip's: a press stays the row's, so a swipe that starts on it still swipes.
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

const CHIP = 'ml-1.5 inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-selected pr-2 pl-1.5 type-control text-foreground';

/**
 * Marks a trip the user takes after its departure time and opens its My trip sheet.
 * `markOnly` is for a row that is itself a button, which cannot hold another one.
 */
export const MyTripChip = ({ departure, markOnly = false }: { departure: Departure; markOnly?: boolean }) => {
    const { t } = useTranslation();
    const entry = useMyTripEntry(departure);
    if (!entry?.isSet) return null;
    const content = (
        <>
            <Route size={12} strokeWidth={2.25} className="text-tint-mint" aria-hidden="true" />
            {t('myTrip.title')}
        </>
    );
    if (markOnly) return <span className={CHIP} data-testid="my-trip-chip">{content}</span>;
    return (
        <button
            type="button"
            onClick={(e) => { stop(e); entry.open(); }}
            onKeyDown={stop}
            aria-label={entry.label}
            title={entry.label}
            data-testid="my-trip-chip"
            className={cn(CHIP, "hit-target cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/50")}
        >
            {content}
        </button>
    );
};
