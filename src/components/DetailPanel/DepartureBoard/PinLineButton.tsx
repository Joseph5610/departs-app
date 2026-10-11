import React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Star } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ButtonTooltip } from '@/components/ButtonTooltip';
import { usePreferencesStore } from '@/state/preferencesStore';
import { isSameFavoriteLine } from '@/domain/departures';
import { PREFERENCES_LIMITS } from '@/config/constants';

/** Pins one line and direction at this stop to the favourites panel. */
export const PinLineButton = ({ stopId, line, headsign, className }: { stopId: string; line: string; headsign: string; className?: string }) => {
    const { t } = useTranslation();
    const city = usePreferencesStore(s => s.selectedCity);
    const favorite = { city, stopId, line, headsign };
    const isPinned = usePreferencesStore(s => s.favoriteLines.some(f => isSameFavoriteLine(f, favorite)));
    const pinnedCount = usePreferencesStore(s => s.favoriteLines.length);
    const { toggleFavoriteLine } = usePreferencesStore(s => s.actions);

    const label = t(isPinned ? 'favorites.unpinLine' : 'favorites.pinLine', { line, headsign });

    const onClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isPinned && pinnedCount >= PREFERENCES_LIMITS.FAVORITE_LINES) {
            toast.error(t('favorites.linesLimit', { count: PREFERENCES_LIMITS.FAVORITE_LINES }));
            return;
        }
        toggleFavoriteLine(favorite);
    };

    return (
        <ButtonTooltip label={label}>
        <button
            type="button"
            onClick={onClick}
            aria-pressed={isPinned}
            aria-label={label}
            data-testid={`pin-line-${line}`}
            className={cn(
                "shrink-0 -mr-1 rounded-full p-1.5 cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/50",
                isPinned ? "text-favorite hover:text-favorite-hover" : "text-muted-foreground/40 hover:text-foreground",
                className
            )}
        >
            <Star size={16} strokeWidth={1.5} fill={isPinned ? 'currentColor' : 'none'} />
        </button>
        </ButtonTooltip>
    );
};
