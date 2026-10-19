import { useMemo } from 'react';
import { useRouteParams } from '@/hooks/useRouteParams';
import { useStops } from '@/hooks/data/useStops';
import type { SelectedStop } from '@/types';
import { selectedStopOf } from '@/domain/stops';

/**
 * A derived data hook that resolves the currently selected stop ID
 * into a full SelectedStop object using the local GeoJSON cache.
 */
export const useSelectedStop = () => {
    const { stopId } = useRouteParams();
    const { stopIndex } = useStops();

    return useMemo((): SelectedStop | null => (stopId ? selectedStopOf(stopId, stopIndex) : null), [stopId, stopIndex]);
};
