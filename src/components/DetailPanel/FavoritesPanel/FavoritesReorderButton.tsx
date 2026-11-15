import { useTranslation } from 'react-i18next';
import { useFavorites } from '@/hooks/derived/useFavorites';
import { useUiStore } from '@/state/uiStore';
import { Button } from '@/components/ui/button';

/** Starts and ends reordering, beside the panel's close button; hidden with nothing to reorder. */
export const FavoritesReorderButton = () => {
    const { t } = useTranslation();
    const { lines, stops, isLoading } = useFavorites();
    const isReordering = useUiStore(s => s.isReorderingFavorites);
    const setIsReordering = useUiStore(s => s.actions.setIsReorderingFavorites);

    if (lines.length < 2 && stops.length < 2) return null;

    return (
        <Button variant="secondary" size="sm" onClick={() => setIsReordering(!isReordering)} disabled={isLoading} data-testid="favorites-reorder-toggle">
            {isReordering ? t('favorites.reorderDone') : t('favorites.reorderStart')}
        </Button>
    );
};
