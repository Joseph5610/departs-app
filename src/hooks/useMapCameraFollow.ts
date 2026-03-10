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
    isFollowing: boolean,
    selectedStop?: { coordinates?: [number, number] } | null
) => {
    useEffect(() => {
        const isMobile = typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false;
        const padding = isMobile
            ? { bottom: window.innerHeight / MOBILE_BOTTOM_SHEET_RATIO, top: 0, left: 0, right: 0 }
            : { bottom: 0, top: 0, left: SIDEBAR_WIDTH, right: 0 };

        if (!isFollowing) {
            // If we are not following a vehicle, but a stop was just selected/enriched, center on it once
            if (selectedStop?.coordinates && mapRef.current) {
                const [lng, lat] = selectedStop.coordinates;
                mapRef.current.easeTo({
                    center: [lng, lat],
                    zoom: Math.max(mapRef.current.getZoom(), 14),
                    duration: 1000,
                    padding
                });
            }
            return;
        }

        if (!selectedVehicle?._geometry || !mapRef.current) return;

        const [lng, lat] = selectedVehicle._geometry;

        // Don't follow if position is unknown/invalid placeholder [0, 0]
        if (lng === 0 && lat === 0) return;

        mapRef.current.easeTo({
            center: [lng, lat],
            duration: 1000,
            essential: true,
            padding
        });
    }, [selectedVehicle?._geometry, isFollowing, mapRef, selectedStop?.coordinates]);
};
