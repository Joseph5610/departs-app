import { useEffect } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import type { TrackedVehicle } from '../types/transit';
import {
    MOBILE_BREAKPOINT,
    MOBILE_BOTTOM_SHEET_RATIO,
    SIDEBAR_WIDTH
} from '../config/constants';

/**
 * Handles smooth camera tracking for the selected vehicle.
 */
export const useMapCameraFollow = (
    mapRef: React.RefObject<MapRef | null>,
    selectedVehicle: TrackedVehicle | null,
    isFollowing: boolean
) => {
    useEffect(() => {
        if (!isFollowing || !selectedVehicle?._geometry || !mapRef.current) return;

        const [lng, lat] = selectedVehicle._geometry;

        // Skip if coordinates are [0, 0] (unset/placeholder) or invalid
        if (!lng || !lat || (lng === 0 && lat === 0)) return;

        const isMobile = typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false;

        mapRef.current.easeTo({
            center: [lng, lat],
            duration: 1000,
            essential: true,
            padding: isMobile
                ? { bottom: window.innerHeight / MOBILE_BOTTOM_SHEET_RATIO, top: 0, left: 0, right: 0 }
                : { bottom: 0, top: 0, left: SIDEBAR_WIDTH, right: 0 }
        });
    }, [selectedVehicle?._geometry, isFollowing, mapRef]);
};
