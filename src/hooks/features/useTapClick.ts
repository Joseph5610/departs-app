import type React from 'react';
import { useRef } from 'react';
import { DEPARTURES_CONFIG } from '@/config/constants';
import type { Departure, DepartureClickHandler } from '@/types';

/**
 * Click handlers that fire `onTap` only for a tap, not for the release of a drag that started on the element
 * (scrolling the board or swiping the sheet). Keyboard activation always counts.
 */
const useTapClick = (onTap: () => void) => {
    const start = useRef<{ x: number; y: number } | null>(null);
    return {
        onPointerDown: (e: React.PointerEvent) => {
            start.current = { x: e.clientX, y: e.clientY };
        },
        onClick: (e: React.MouseEvent) => {
            if (e.detail === 0) {
                onTap();
                return;
            }
            const from = start.current;
            start.current = null;
            if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) < DEPARTURES_CONFIG.TAP_SLOP_PX) onTap();
        },
    };
};

/** Tap handlers that open `dep`'s trip, for any element showing a departure. */
export const useDepartureTap = (dep: Departure, onDepartureClick: DepartureClickHandler) =>
    useTapClick(() => {
        if (dep.tripId) onDepartureClick(dep.tripId, dep.vehicleId, dep);
    });
