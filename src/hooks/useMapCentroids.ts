import { useMemo } from 'react';
import type { StopCollection } from '../types/transit';

/**
 * Groups raw stops into geographic centroids for cleaner map labeling.
 * Consumes pre-calculated centroids from the backend (is_centroid: true).
 */
export const useMapCentroids = (stopsData: StopCollection | null) => {
    return useMemo(() => {
        if (!stopsData) return null;

        const labelFeatures = stopsData.features.filter(f => f.properties.is_centroid);

        return {
            type: 'FeatureCollection',
            features: labelFeatures
        } as StopCollection;
    }, [stopsData]);
};
