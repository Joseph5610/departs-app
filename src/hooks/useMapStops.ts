import { useMemo } from 'react';
import type { StopCollection } from '../types/transit';
import { useStops } from './useStops';

/**
 * Returns stops filtered for map display (excluding labels/centroids).
 */
export const useMapStops = () => {
    const { data: stopsData } = useStops();

    return useMemo(() => {
        if (!stopsData) return null;

        return {
            type: 'FeatureCollection',
            features: stopsData.features.filter(f => !f.properties.is_centroid)
        } as StopCollection;
    }, [stopsData]);
};
