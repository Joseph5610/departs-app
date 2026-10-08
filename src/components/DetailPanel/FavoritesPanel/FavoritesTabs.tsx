import { useTranslation } from 'react-i18next';
import { MapPin, Route } from 'lucide-react';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useFavorites } from '@/hooks/derived/useFavorites';
import { PanelTabs } from '@/components/PanelTabs';

/** Switches the favourites panel between pinned lines and stops; hidden unless both are pinned. */
export const FavoritesTabs = () => {
    const { t } = useTranslation();
    const setTab = usePreferencesStore(s => s.actions.setFavoritesTab);
    const { allLines, allStops, hasTabs, tab } = useFavorites();

    if (!hasTabs) return null;

    return (
        <PanelTabs
            value={tab}
            onChange={setTab}
            tabs={[
                { value: 'lines', icon: <Route size={14} />, label: t('favorites.tabLines'), count: allLines.length, testId: 'favorites-tab-lines' },
                { value: 'stops', icon: <MapPin size={14} />, label: t('favorites.tabStops'), count: allStops.length, testId: 'favorites-tab-stops' },
            ]}
        />
    );
};
