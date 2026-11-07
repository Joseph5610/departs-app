import { useCallback, useMemo } from 'react';
import { useRouteMetadataOf } from '@/hooks/data/useRouteMetadata';
import { usePreferencesStore } from '@/state/preferencesStore';
import { historyItemLines, type LineMetadata } from '@/domain/routes';
import type { ShownHistoryItem } from '@/types';

const NO_ROUTES: ReadonlyMap<string, LineMetadata> = new Map();

/** The line badges of recent searches, each branded by its own city, as history spans cities. */
export const useHistoryLines = (history: readonly ShownHistoryItem[]) => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const cityList = history.map(item => item.city_slug ?? selectedCity);
    const cityKey = [...new Set(cityList)].join('|');
    const cities = useMemo(() => (cityKey ? cityKey.split('|') : []), [cityKey]);
    const metadata = useRouteMetadataOf(cities);

    return useCallback(
        (item: ShownHistoryItem) => historyItemLines(item, metadata.get(item.city_slug ?? selectedCity)?.byName ?? NO_ROUTES),
        [metadata, selectedCity],
    );
};
