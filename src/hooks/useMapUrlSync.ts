import { useEffect, useRef } from 'react';

import { useStops } from './useStops';

/**
 * Syncs the selected stop and map camera position with browser URL search parameters.
 * Allows for shareable links and state persistence on refresh.
 */
export const useMapUrlSync = (
    selectedStop: { id: string; name: string; coordinates?: [number, number] } | null,
    setSelectedStop: (stop: { id: string; name: string; coordinates?: [number, number] } | null | ((prev: { id: string; name: string; coordinates?: [number, number] } | null) => { id: string; name: string; coordinates?: [number, number] } | null)) => void
) => {
    const initialized = useRef(false);
    const { data: stops } = useStops();

    // 1. Initial Load: Read from URL
    useEffect(() => {
        if (initialized.current) return;

        const p = new URLSearchParams(window.location.search);
        const id = p.get('stopId');
        const name = p.get('stopName');

        if (id && name && !selectedStop) {
            setSelectedStop({ id, name });
        }
        initialized.current = true;
    }, [setSelectedStop, selectedStop]);

    // 2. Data Enrichment: Find coordinates once stops are loaded
    useEffect(() => {
        if (selectedStop && !selectedStop.coordinates && stops?.features) {
            const match = stops.features.find(f => f.properties.stop_id === selectedStop.id || f.properties.all_ids?.includes(selectedStop.id));
            if (match) {
                setSelectedStop(prev => prev ? { ...prev, coordinates: match.geometry.coordinates } : null);
            }
        }
    }, [selectedStop, stops, setSelectedStop]);

    // 2. State Change: Write to URL
    useEffect(() => {
        const url = new URL(window.location.href);
        if (selectedStop) {
            url.searchParams.set('stopId', selectedStop.id);
            url.searchParams.set('stopName', selectedStop.name);
        } else {
            url.searchParams.delete('stopId');
            url.searchParams.delete('stopName');
        }
        window.history.replaceState({}, '', url.toString());
    }, [selectedStop]);
};
