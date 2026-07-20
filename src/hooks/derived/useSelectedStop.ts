import { useMemo } from 'react';
import { useRouteParams } from '../useRouteParams';
import { useStops } from '../data/useStops';
import type { SelectedStop } from '../../types/transit';

/**
 * useSelectedStop
 *
 * A derived data hook that resolves the currently selected stop ID
 * into a full SelectedStop object using the local GeoJSON cache.
 */
export const useSelectedStop = () => {
    const { stopId } = useRouteParams();
    const { stopIndex } = useStops();

    return useMemo((): SelectedStop | null => {
        if (!stopId) {
            return null;
        }

        const feature = stopIndex.get(stopId);

        if (!feature) {
            return { stop_id: stopId };
        }

        const { stop_name, platform_code, all_ids, is_train, metro_lines, lines } = feature.properties;
        return {
            stop_id: feature.properties.stop_id,
            stop_name,
            platform_code,
            all_ids,
            is_train: Number(is_train) === 1 ? 1 : 0,
            metro_lines,
            lines,
            coordinates: feature.geometry.coordinates as [number, number]
        };
    }, [stopId, stopIndex]);
};
