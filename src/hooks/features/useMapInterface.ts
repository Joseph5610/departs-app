import { useEffect, useRef } from 'react';
import { useRouteParams } from '@/hooks/useRouteParams';
import { useSelectionStore } from '@/state/selectionStore';
import { useMapMetadataStore } from '@/state/mapMetadataStore';
import { useIsMobile } from '@/hooks/useIsMobile';
import { MAP_LAYERS } from '@/config/mapLayers';
import { hasPosition } from '@/lib/geo';
import { useSelectedStop } from '@/hooks/derived/useSelectedStop';
import { useSelectedVehicle } from '@/hooks/derived/useSelectedVehicle';
import { MAP_CAMERA, LAYOUT, SELECTED_VEHICLE_PULSE } from '@/config/constants';

/** Sidebar geometry lives in index.css; the camera padding must match it. */
const readRootCssPx = (name: string): number =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;

/**
 * The "User Experience Layer" hook.
 */
export const useMapInterface = () => {
    const { stopId: selectedStopId, tripId: selectedTripId, vehicleId: selectedVehicleId } = useRouteParams();

    const isFollowing = useSelectionStore(s => s.isFollowing);

    const mapRef = useMapMetadataStore(s => s.mapRef);
    const mapLoaded = useMapMetadataStore(s => s.mapLoaded);
    const { flyTo, easeTo } = useMapMetadataStore(s => s.actions);

    const selectedStop = useSelectedStop();
    const selectedVehicle = useSelectedVehicle();
    const isMobile = useIsMobile();

    const lastFlownId = useRef<string | null>(null);
    const lastFlownStopId = useRef<string | null>(null);

    // Camera: fly to a newly followed vehicle, keep easing after it, or ease to a newly opened stop.
    useEffect(() => {
        if (!mapLoaded || !mapRef.current) {
            return;
        }

        const padding = isMobile
            ? { bottom: window.innerHeight / LAYOUT.BOTTOM_SHEET_RATIO, top: 0, left: 0, right: 0 }
            : { bottom: 0, top: 0, left: readRootCssPx('--sidebar-width') + readRootCssPx('--sidebar-inset'), right: 0 };

        const currentMap = mapRef.current;
        const currentId = selectedVehicleId || selectedTripId;
        const coords = selectedVehicle?.geometry?.coordinates;
        const hasCoords = hasPosition(coords);

        // Returning to the stop after a trip must re-centre on it.
        if (selectedTripId) {
            lastFlownStopId.current = null;
        }

        if (isFollowing && hasCoords && lastFlownId.current !== currentId) {
            lastFlownId.current = currentId || null;
            flyTo({
                center: coords,
                zoom: MAP_CAMERA.VEHICLE_SELECT_ZOOM,
                duration: MAP_CAMERA.ANIMATION_MS,
                essential: true,
                padding
            });
            return;
        }

        if (isFollowing && hasCoords) {
            easeTo({
                center: coords,
                duration: MAP_CAMERA.EASE_MS,
                essential: true,
                padding
            });
            return;
        }

        if (!isFollowing && !selectedTripId && selectedStop?.coordinates && lastFlownStopId.current !== selectedStopId) {
            lastFlownStopId.current = selectedStopId || null;
            easeTo({
                center: selectedStop.coordinates,
                zoom: Math.max(currentMap.getZoom(), MAP_CAMERA.MIN_STOP_ZOOM),
                duration: MAP_CAMERA.EASE_MS,
                padding
            });
        }
    }, [selectedVehicle?.geometry?.coordinates, isFollowing, mapRef, flyTo, easeTo, selectedStop?.coordinates, selectedTripId, selectedVehicleId, selectedStopId, isMobile, mapLoaded]);

    // Selected vehicle pulse, animated on the map layer directly to stay off React renders.
    const selectedCoordsRef = useRef(selectedVehicle?.geometry?.coordinates);
    useEffect(() => {
        selectedCoordsRef.current = selectedVehicle?.geometry?.coordinates;
    }, [selectedVehicle?.geometry?.coordinates]);
    const hasSelectedVehicle = !!selectedVehicle;

    useEffect(() => {
        let frame: number;
        const currentMapRef = mapRef.current;

        const animate = () => {
            const map = mapRef.current?.getMap();
            const coords = selectedCoordsRef.current;
            if (map && hasPosition(coords)) {
                const time = Date.now() / SELECTED_VEHICLE_PULSE.SPEED_DIVISOR;
                const radius = SELECTED_VEHICLE_PULSE.BASE_RADIUS + Math.sin(time) * SELECTED_VEHICLE_PULSE.RADIUS_AMPLITUDE;
                const opacity = SELECTED_VEHICLE_PULSE.BASE_OPACITY - ((radius - 5) / SELECTED_VEHICLE_PULSE.OPACITY_DIVISOR);

                try {
                    if (map.getLayer(MAP_LAYERS.SELECTED_VEHICLE_PULSE)) {
                        map.setPaintProperty(MAP_LAYERS.SELECTED_VEHICLE_PULSE, 'circle-radius', radius);
                        map.setPaintProperty(MAP_LAYERS.SELECTED_VEHICLE_PULSE, 'circle-opacity', Math.max(0.1, opacity));
                    }
                } catch {
                    /* Silent fail */
                }
            }
            frame = requestAnimationFrame(animate);
        };

        if (hasSelectedVehicle) {
            frame = requestAnimationFrame(animate);
        }

        return () => {
            if (frame) {
                cancelAnimationFrame(frame);
            }
            const map = currentMapRef?.getMap();
            if (map && map.getLayer(MAP_LAYERS.SELECTED_VEHICLE_PULSE)) {
                try {
                    map.setPaintProperty(MAP_LAYERS.SELECTED_VEHICLE_PULSE, 'circle-radius', 0);
                    map.setPaintProperty(MAP_LAYERS.SELECTED_VEHICLE_PULSE, 'circle-opacity', 0);
                } catch {
                    /* Silent fail */
                }
            }
        };
    }, [hasSelectedVehicle, mapRef]);
};
