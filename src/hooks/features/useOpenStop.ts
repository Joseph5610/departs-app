import { useCallback } from 'react';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useMapMetadataStore } from '@/state/mapMetadataStore';
import { useSelectionStore } from '@/state/selectionStore';
import { navigate } from '@/lib/history';
import { paths } from '@/lib/routes';
import { MAP_CAMERA } from '@/config/constants';

interface OpenStopOptions {
    /** Flies the map to the stop first. */
    pos?: [number, number];
    /** The stop's city when it is not the selected one, as a pinned line's. */
    city?: string;
    /** Opens the board filtered to this line. */
    line?: string;
}

/** Opens a stop's board, by default in the selected city. */
export const useOpenStop = () => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const flyTo = useMapMetadataStore(s => s.actions.flyTo);
    const { presetLineFilter } = useSelectionStore(s => s.actions);
    return useCallback((stopId: string, { pos, city, line }: OpenStopOptions = {}) => {
        if (pos) flyTo({ center: pos, zoom: MAP_CAMERA.STOP_SELECT_ZOOM, duration: MAP_CAMERA.FLY_MS });
        if (line) presetLineFilter(line);
        navigate(paths.stop(city ?? selectedCity, stopId));
    }, [selectedCity, flyTo, presetLineFilter]);
};
