import { useMemo } from 'react';
import { useSelection } from '../../state/MapStateProvider';
import { useStops } from '../data/useStops';
import type { SelectedStop } from '../../types/transit';

/**
 * useSelectedStop
 *
 * A derived data hook that resolves the currently selected stop ID
 * into a full SelectedStop object using the local GeoJSON cache.
 */
export const useSelectedStop = () => {
    const { state } = useSelection();
    const { allFeatures: stopsData } = useStops();
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
            is_train: Number(is_train) === 1 ? 1 : 0,

            coordinates: feature.geometry.coordinates as [number, number]
        };
    }, [stopId, stopsData]);
};
