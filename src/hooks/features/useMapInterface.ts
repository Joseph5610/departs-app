import { useEffect, useRef } from 'react';
import { useRouteParams } from '../useRouteParams';
import { useSelectionStore } from '../../state/selectionStore';
import { useMapMetadataStore } from '../../state/mapMetadataStore';
import { useIsMobile } from '../useIsMobile';
import { useSelectedStop } from '../derived/useSelectedStop';
import { useSelectedVehicle } from '../derived/useSelectedVehicle';
import {
    MAP_VEHICLE_SELECT_ZOOM,
    MAP_ANIMATION_DURATION,
    MAP_EASE_DURATION,
    MAP_MIN_STOP_ZOOM,
    MOBILE_BOTTOM_SHEET_RATIO,
    SIDEBAR_WIDTH,
    PULSE_SPEED_DIVISOR,
    PULSE_BASE_RADIUS,
    PULSE_RADIUS_AMPLITUDE,
    PULSE_BASE_OPACITY,
    PULSE_OPACITY_DIVISOR
} from '../../config/constants';

/**
 * useMapInterface
 *
 * The "User Experience Layer" hook.
 */
export const useMapInterface = () => {
    // Route Params
    const { stopId: selectedStopId, tripId: selectedTripId, vehicleId: selectedVehicleId } = useRouteParams();
    
    // Selection Store
    const isFollowing = useSelectionStore(s => s.isFollowing);

    // Metadata Store
    const mapRef = useMapMetadataStore(s => s.mapRef);
    const mapLoaded = useMapMetadataStore(s => s.mapLoaded);
    const { flyTo, easeTo } = useMapMetadataStore(s => s.actions);

    const selectedStop = useSelectedStop();
    const selectedVehicle = useSelectedVehicle();
    const isMobile = useIsMobile();

    const lastFlownId = useRef<string | null>(null);
    const lastFlownStopId = useRef<string | null>(null);

    // --- 3. CAMERA FOLLOW ---
    useEffect(() => {
        if (!mapLoaded || !mapRef.current) {
            return;
        }

        const padding = isMobile
            ? { bottom: window.innerHeight / MOBILE_BOTTOM_SHEET_RATIO, top: 0, left: 0, right: 0 }
            : { bottom: 0, top: 0, left: SIDEBAR_WIDTH, right: 0 };

        const currentMap = mapRef.current;
        const currentId = selectedVehicleId || selectedTripId;
        const coords = selectedVehicle?.geometry?.coordinates;
        const hasCoords = coords && (coords[0] !== 0 || coords[1] !== 0);

        // If we are following a vehicle or just have one selected,
        // we reset the last flown stop ID so that returning to the stop triggers a re-center.
        if (selectedTripId) {
            lastFlownStopId.current = null;
        }

        if (isFollowing && hasCoords && lastFlownId.current !== currentId) {
            lastFlownId.current = currentId || null;
            flyTo({
                center: coords as [number, number],
                zoom: MAP_VEHICLE_SELECT_ZOOM,
                duration: MAP_ANIMATION_DURATION,
                essential: true,
                padding
            });
            return;
        }

        if (isFollowing && hasCoords) {
            easeTo({
                center: coords as [number, number],
                duration: MAP_EASE_DURATION,
                essential: true,
                padding
            });
            return;
        }

        if (!isFollowing && !selectedTripId && selectedStop?.coordinates && lastFlownStopId.current !== selectedStopId) {
            lastFlownStopId.current = selectedStopId || null;
            easeTo({
                center: selectedStop.coordinates,
                zoom: Math.max(currentMap.getZoom(), MAP_MIN_STOP_ZOOM),
                duration: MAP_EASE_DURATION,
                padding
            });
        }
    }, [selectedVehicle?.geometry?.coordinates, isFollowing, mapRef, flyTo, easeTo, selectedStop?.coordinates, selectedTripId, selectedVehicleId, selectedStopId, isMobile, mapLoaded]);

    // --- 4. PERFORMANCE VISUALS ---
    useEffect(() => {
        let frame: number;
        const currentMapRef = mapRef.current;

        const animate = () => {
            const map = mapRef.current?.getMap();
            const coords = selectedVehicle?.geometry?.coordinates;
            const hasCoords = coords && (coords[0] !== 0 || coords[1] !== 0);

            if (map && hasCoords) {
                const time = Date.now() / PULSE_SPEED_DIVISOR;
                const radius = PULSE_BASE_RADIUS + Math.sin(time) * PULSE_RADIUS_AMPLITUDE;
                const opacity = PULSE_BASE_OPACITY - ((radius - 5) / PULSE_OPACITY_DIVISOR);

                try {
                    if (map.getLayer('vehicle-selected-pulse')) {
                        map.setPaintProperty('vehicle-selected-pulse', 'circle-radius', radius);
                        map.setPaintProperty('vehicle-selected-pulse', 'circle-opacity', Math.max(0.1, opacity));
                    }
                } catch {
                    /* Silent fail */
                }
            }
            frame = requestAnimationFrame(animate);
        };

        if (selectedVehicle) {
            frame = requestAnimationFrame(animate);
        }

        return () => {
            if (frame) {
                cancelAnimationFrame(frame);
            }
            const map = currentMapRef?.getMap();
            if (map && map.getLayer('vehicle-selected-pulse')) {
                try {
                    map.setPaintProperty('vehicle-selected-pulse', 'circle-radius', 0);
                    map.setPaintProperty('vehicle-selected-pulse', 'circle-opacity', 0);
                } catch {
                    /* Silent fail */
                }
            }
        };
    }, [selectedVehicle, mapRef]);
};
