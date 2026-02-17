import { useEffect } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import type { TrackedVehicle } from '../types/transit';

/**
 * Handles the pulsing animation for a selected vehicle on the map.
 * PERFORMANCE OPTIMIZATION: 
 * This hook uses requestAnimationFrame and DIRECT MapLibre mutations via `setPaintProperty`.
 * We bypass React state updates for the animation loop to maintain 60FPS even with hundreds 
 * of vehicles on the map, avoiding expensive React re-renders triggered by state changes.
 */
export const useMapAnimation = (
    mapRef: React.RefObject<MapRef | null>,
    selectedVehicle: TrackedVehicle | null,
    isFollowing: boolean
) => {
    useEffect(() => {
        let frame: number;
        const currentMapRef = mapRef.current;

        const animate = () => {
            const map = currentMapRef?.getMap();
            if (map && selectedVehicle && isFollowing) {
                const time = Date.now() / 350;
                const radius = 20 + Math.sin(time) * 15; // Base 20, pulse +/- 15
                const opacity = 0.6 - ((radius - 5) / 50); // Fade out as it expands

                try {
                    if (map.getLayer('selected-vehicle-pulse')) {
                        map.setPaintProperty('selected-vehicle-pulse', 'circle-radius', radius);
                        map.setPaintProperty('selected-vehicle-pulse', 'circle-opacity', Math.max(0.1, opacity));
                    }
                } catch {
                    // Layer might not be ready yet
                }
            }
            frame = requestAnimationFrame(animate);
        };

        if (selectedVehicle && isFollowing) {
            frame = requestAnimationFrame(animate);
        }

        return () => {
            if (frame) cancelAnimationFrame(frame);
            const map = currentMapRef?.getMap();
            if (map && map.getLayer('selected-vehicle-pulse')) {
                try {
                    map.setPaintProperty('selected-vehicle-pulse', 'circle-radius', 0);
                    map.setPaintProperty('selected-vehicle-pulse', 'circle-opacity', 0);
                } catch {
                    // Silently fail
                }
            }
        };
    }, [selectedVehicle, isFollowing, mapRef]);
};
