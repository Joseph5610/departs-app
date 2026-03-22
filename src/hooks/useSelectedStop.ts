import { useMemo } from 'react';
import { useMap } from './useMap';
import { useStops } from './useStops';
import type { SelectedStop } from '../types/transit';

/**
 * useSelectedStop
 *
 * A derived data hook that resolves the currently selected stop ID
 * into a full SelectedStop object using the local GeoJSON cache.
 */
export const useSelectedStop = () => {
    const { state } = useMap();
    const { _raw_data: stopsData } = useStops();
    const stopId = state.selectedStopId;

    return useMemo((): SelectedStop | null => {
        if (!stopId) {
            return null;
        }

        if (!stopsData) {
            return { stop_id: stopId };
        }

        const feature = stopsData.features.find(f => f.properties.stop_id === stopId || f.properties.all_ids?.includes(stopId));

        if (!feature) {
            return { stop_id: stopId };
        }

        const { stop_name, platform_code, all_ids, is_train } = feature.properties;
        return {
            stop_id: feature.properties.stop_id,
            stop_name,
            platform_code,
            all_ids,
            is_train: is_train === 1,
            coordinates: feature.geometry.coordinates as [number, number]
        };
    }, [stopId, stopsData]);
};
