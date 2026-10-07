import { useMemo } from 'react';
import { useRouteParams } from '@/hooks/useRouteParams';
import { useStops } from '@/hooks/data/useStops';
import type { SelectedStop } from '@/types';
import { toSelectedStop } from '@/domain/stops';

/**
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

        return toSelectedStop(feature);
    }, [stopId, stopIndex]);
};
