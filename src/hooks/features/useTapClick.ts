import type React from 'react';
import { useRef } from 'react';
import { DEPARTURES_CONFIG } from '@/config/constants';
import type { Departure, DepartureClickHandler } from '@/types';
import { useSelectionStore } from '@/state/selectionStore';

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

/** Tap handlers that open `dep`'s trip, for any element showing a departure; the trip learns the stop it was opened from. */
export const useDepartureTap = (dep: Departure, onDepartureClick: DepartureClickHandler) => {
    const { setBoardingStop } = useSelectionStore(s => s.actions);
    return useTapClick(() => {
        if (!dep.tripId) return;
        setBoardingStop(dep.tripId, dep.platformStopId ?? dep.stopId ?? null);
        onDepartureClick(dep.tripId, dep.vehicleId, dep);
    });
};
