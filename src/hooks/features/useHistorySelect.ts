import { useCallback } from 'react';
import { navigate } from '@/lib/history';
import { paths } from '@/lib/routes';
import { rememberPlace } from '@/hooks/data/useGeocoding';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useViewportStore } from '@/state/viewportStore';
import { useMapMetadataStore } from '@/state/mapMetadataStore';
import { MAP_CAMERA } from '@/config/constants';
import type { SearchHistoryItem } from '@/types';

/**
 * Opens a recent search again: a stop or point of sale, a line filter or a place.
 * Returns the text the search box should keep, the place name for a place and empty otherwise.
 */
export const useHistorySelect = () => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { addToHistory } = usePreferencesStore(s => s.actions);
    const { setRouteFilter, setSelectedPlaceId } = useViewportStore(s => s.actions);
    const flyTo = useMapMetadataStore(s => s.actions.flyTo);

    return useCallback((item: SearchHistoryItem): string => {
        const targetCity = item.city_slug || selectedCity;
        const flyToResult = (center: [number, number]) => flyTo({ center, zoom: MAP_CAMERA.STOP_SELECT_ZOOM, duration: MAP_CAMERA.FLY_MS });

        if (item.type === 'place') {
            navigate(paths.city(targetCity));
            flyToResult(item.coordinates);
            rememberPlace({ id: item.place_id, name: item.name, subtitle: item.subtitle || '', coordinates: item.coordinates });
            setSelectedPlaceId(item.place_id);
            return item.name;
        }
        if (item.type === 'line') {
            setRouteFilter(item.lines);
        } else {
            flyToResult(item.coordinates);
            navigate(item.type === 'stop' ? paths.stop(targetCity, item.stop_id) : paths.pos(targetCity, item.pos_id));
        }
        addToHistory(item);
        return '';
    }, [selectedCity, addToHistory, setRouteFilter, setSelectedPlaceId, flyTo]);
};
