import { useEffect, useRef } from 'react';
import type { SelectedStop } from './useMapReducer';

/**
 * Syncs the selected stop and map camera position with browser URL search parameters.
 * Allows for shareable links and state persistence on refresh.
 */
export const useMapUrlSync = (
    selectedStop: SelectedStop | null,
    setSelectedStop: (stop: SelectedStop | null | ((prev: SelectedStop | null) => SelectedStop | null)) => void
) => {
    const initialized = useRef(false);

    // 1. Initial Load: Read from URL
    useEffect(() => {
        if (initialized.current) return;

        const p = new URLSearchParams(window.location.search);
        const id = p.get('stopId');
        const name = p.get('stopName');
        const platform = p.get('stopPlatform');

        if (id && name && !selectedStop) {
            let finalName = name;
            let finalPlatform = platform;

            // Backward compatibility: Extract platform from name if it follows "Name (A)" format
            if (!finalPlatform) {
                const match = name.match(/(.+)\s\((.+)\)$/);
                if (match) {
                    finalName = match[1];
                    finalPlatform = match[2];
                }
            }

            setSelectedStop({ id, name: finalName, platformCode: finalPlatform || undefined });
        }
        initialized.current = true;
    }, [setSelectedStop, selectedStop]);

    // 2. State Change: Write to URL
    useEffect(() => {
        const url = new URL(window.location.href);
        if (selectedStop) {
            url.searchParams.set('stopId', selectedStop.id);
            url.searchParams.set('stopName', selectedStop.name);
            if (selectedStop.platformCode) {
                url.searchParams.set('stopPlatform', selectedStop.platformCode);
            } else {
                url.searchParams.delete('stopPlatform');
            }
        } else {
            url.searchParams.delete('stopId');
            url.searchParams.delete('stopName');
            url.searchParams.delete('stopPlatform');
        }
        window.history.replaceState({}, '', url.toString());
    }, [selectedStop]);
};
