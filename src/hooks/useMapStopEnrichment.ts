import { useEffect, useRef } from 'react';
import type { StopCollection, SelectedStop } from '../types/transit';

/**
 * useMapStopEnrichment
 *
 * Enriches a partially loaded stop (e.g. from URL) with names and coordinates
 * from the GeoJSON stop collection once it's available.
 */
export const useMapStopEnrichment = (
    selectedStop: SelectedStop | null,
    setSelectedStop: (stop: SelectedStop | null | ((prev: SelectedStop | null) => SelectedStop | null)) => void,
    stopsData: StopCollection | null
) => {
    const lastEnrichedId = useRef<string | null>(null);

    useEffect(() => {
        if (!selectedStop || !stopsData || lastEnrichedId.current === selectedStop.stop_id) {
            return;
        }

        const { stop_id, stop_name, coordinates } = selectedStop;
        if (stop_name && coordinates) {
            lastEnrichedId.current = stop_id;
            return;
        }

        const feature = stopsData.features.find((f) => {
            return f.properties.stop_id === stop_id ||
                   f.properties.all_ids?.includes(stop_id);
        });

        if (feature) {
            const { stop_name: name, platform_code, all_ids } = feature.properties;
            setSelectedStop((prev) => prev?.stop_id === stop_id ? {
                ...prev,
                stop_name: prev.stop_name || name,
                platform_code: prev.platform_code || platform_code,
                coordinates: prev.coordinates || (feature.geometry.coordinates as [number, number]),
                all_ids: all_ids
            } : prev);
            lastEnrichedId.current = stop_id;
        }
    }, [selectedStop, stopsData, setSelectedStop]);
};
