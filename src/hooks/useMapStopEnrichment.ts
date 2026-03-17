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
            lastCheckedId.current = selectedStop?.id || null;
            return;
        }

        // Only run if the stop ID has changed or we haven't successfully enriched it yet
        if (lastCheckedId.current === selectedStop.id) return;

        const feature = stopsData.features.find(f => f.properties.stop_id === selectedStop.id);
        if (feature) {
            setSelectedStop((prev: SelectedStop | null) => prev?.id === selectedStop.id ? {
                ...prev,
                coordinates: feature.geometry.coordinates as [number, number],
                all_ids: feature.properties.all_ids
            } : prev);
            lastCheckedId.current = selectedStop.id;
        } else {
            // Check centroids if not found in unclustered stops
            const centroid = stopsData.features.find(f => f.properties.stop_id === selectedStop.id || f.properties.all_ids?.includes(selectedStop.id));
             if (centroid) {
                setSelectedStop((prev: SelectedStop | null) => prev?.id === selectedStop.id ? {
                    ...prev,
                    coordinates: centroid.geometry.coordinates as [number, number],
                    all_ids: centroid.properties.all_ids
                } : prev);
                lastCheckedId.current = selectedStop.id;
             }
        }
    }, [selectedStop, stopsData, setSelectedStop]);
};
