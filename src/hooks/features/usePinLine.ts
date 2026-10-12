import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { usePreferencesStore } from '@/state/preferencesStore';
import { isSameFavoriteLine } from '@/domain/departures';
import { PREFERENCES_LIMITS } from '@/config/constants';

/** Whether one line and direction at a stop is pinned, and a toggle that confirms the change with an undo. */
export const usePinLine = (stopId: string, line: string, headsign: string) => {
    const { t } = useTranslation();
    const city = usePreferencesStore(s => s.selectedCity);
    const isPinned = usePreferencesStore(s => s.favoriteLines.some(f => isSameFavoriteLine(f, { city, stopId, line, headsign })));
    const pinnedCount = usePreferencesStore(s => s.favoriteLines.length);
    const { toggleFavoriteLine } = usePreferencesStore(s => s.actions);

    const toggle = () => {
        const favorite = { city, stopId, line, headsign };
        if (!isPinned && pinnedCount >= PREFERENCES_LIMITS.FAVORITE_LINES) {
            toast.error(t('favorites.linesLimit', { count: PREFERENCES_LIMITS.FAVORITE_LINES }));
            return;
        }
        toggleFavoriteLine(favorite);
        toast.success(t(isPinned ? 'favorites.lineUnpinned' : 'favorites.linePinned', { line, headsign }), {
            action: { label: t('favorites.undo'), onClick: () => toggleFavoriteLine(favorite) },
        });
    };

    return { isPinned, toggle, label: t(isPinned ? 'favorites.unpinLine' : 'favorites.pinLine', { line, headsign }) };
};
