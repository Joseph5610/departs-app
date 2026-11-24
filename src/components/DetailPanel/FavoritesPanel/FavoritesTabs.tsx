import { useTranslation } from 'react-i18next';
import { MapPin, Route } from 'lucide-react';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useFavorites } from '@/hooks/derived/useFavorites';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/** Switches the favourites panel between pinned lines and stops; hidden unless both are pinned. */
export const FavoritesTabs = () => {
    const { t } = useTranslation();
    const setTab = usePreferencesStore(s => s.actions.setFavoritesTab);
    const { allLines, allStops, hasTabs, tab } = useFavorites();

    if (!hasTabs) return null;

    return (
        <Tabs value={tab} onValueChange={setTab} className="shrink-0 px-(--panel-gutter) pb-2">
            <TabsList>
                <TabsTrigger value="lines" data-testid="favorites-tab-lines"><Route size={14} />{t('favorites.tabLines')}<span className="opacity-60">{allLines.length}</span></TabsTrigger>
                <TabsTrigger value="stops" data-testid="favorites-tab-stops"><MapPin size={14} />{t('favorites.tabStops')}<span className="opacity-60">{allStops.length}</span></TabsTrigger>
            </TabsList>
        </Tabs>
    );
};
