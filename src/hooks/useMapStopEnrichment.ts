import { useEffect, useRef } from 'react';
import type { StopCollection, SelectedStop } from '../types/transit';

/**
 * Enriches the selected stop with coordinates from the GeoJSON data if they are missing.
 * This typically happens when a stop is loaded from a URL parameter.
 */
export const useMapStopEnrichment = (
    selectedStop: SelectedStop | null,
    setSelectedStop: (stop: SelectedStop | null | ((prev: SelectedStop | null) => SelectedStop | null)) => void,
    stopsData: StopCollection | null
) => {
    const lastCheckedId = useRef<string | null>(null);

    useEffect(() => {
        if (!selectedStop || !stopsData || selectedStop.coordinates) {
            lastCheckedId.current = selectedStop?.stop_id || null;
            return;
        }

        const sid = selectedStop.stop_id;

        // Only run if the stop ID has changed or we haven't successfully enriched it yet
        if (lastCheckedId.current === sid) return;

        const feature = stopsData.features.find(f => f.properties.stop_id === sid);
        if (feature) {
            setSelectedStop((prev: SelectedStop | null) => prev?.stop_id === sid ? {
                ...prev,
                coordinates: feature.geometry.coordinates as [number, number],
                all_ids: feature.properties.all_ids
            } : prev);
            lastCheckedId.current = sid;
        } else {
            // Check centroids if not found in unclustered stops
            const centroid = stopsData.features.find(f => f.properties.stop_id === sid || f.properties.all_ids?.includes(sid));
             if (centroid) {
                setSelectedStop((prev: SelectedStop | null) => prev?.stop_id === sid ? {
                    ...prev,
                    coordinates: centroid.geometry.coordinates as [number, number],
                    all_ids: centroid.properties.all_ids
                } : prev);
                lastCheckedId.current = sid;
             }
        }
    }, [selectedStop, stopsData, setSelectedStop]);
};
