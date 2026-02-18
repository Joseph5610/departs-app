import { useEffect, useRef } from 'react';

/**
 * Syncs the selected stop and map camera position with browser URL search parameters.
 * Allows for shareable links and state persistence on refresh.
 */
export const useMapUrlSync = (
    selectedStop: { id: string; name: string } | null,
    setSelectedStop: (stop: { id: string; name: string } | null) => void
) => {
    const initialized = useRef(false);

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
