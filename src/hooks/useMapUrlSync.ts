import { useEffect } from 'react';

/**
 * Syncs the selected stop and map camera position with browser URL search parameters.
 * Allows for shareable links and state persistence on refresh.
 */
export const useMapUrlSync = (
    selectedStop: { id: string; name: string } | null,
    setSelectedStop: (stop: { id: string; name: string } | null) => void
) => {
    // 1. Initial Load: Read from URL
    useEffect(() => {
        const p = new URLSearchParams(window.location.search);
        const id = p.get('stopId');
        const name = p.get('stopName');
        if (id && name && !selectedStop) {
            setSelectedStop({ id, name });
        }
    }, [setSelectedStop]);

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
