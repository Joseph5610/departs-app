import { useEffect, useRef } from 'react';
import { useSelection, useViewport } from '../../state/contexts';
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
    const { state: selState, actions: selActions } = useSelection();
    const { mapRef } = useViewport();
    const { selectedStopId, selectedTripId, selectedVehicleId, isFollowing } = selState;
    const { selectStop, selectVehicle } = selActions;

    const selectedStop = useSelectedStop();
    const selectedVehicle = useSelectedVehicle();
    const isMobile = useIsMobile();

    const initialized = useRef(false);
    const lastFlownId = useRef<string | null>(null);
    const lastFlownStopId = useRef<string | null>(null);

    // --- 1. URL SYNC (Initial Load) ---
    useEffect(() => {
        if (initialized.current) {
            return;
        }
        const p = new URLSearchParams(window.location.search);

        const stopId = p.get('stopId');
        if (stopId && !selectedStopId) {
            selectStop(stopId);
        }

        const tripId = p.get('tripId');
        const vehicleId = p.get('vehicleId');
        if (tripId && !selectedTripId) {
            selectVehicle(tripId, vehicleId, !!stopId);
        }

        initialized.current = true;
    }, [selectedStopId, selectedTripId, selectStop, selectVehicle]);

    // --- 2. URL SYNC (Write) ---
    useEffect(() => {
        const url = new URL(window.location.href);
        const sp = url.searchParams;

        if (selectedStopId) {
            sp.set('stopId', selectedStopId);
        } else {
            sp.delete('stopId');
        }

        if (selectedTripId) {
            sp.set('tripId', selectedTripId);
            if (selectedVehicleId) {
                sp.set('vehicleId', selectedVehicleId);
            } else {
                sp.delete('vehicleId');
            }
        } else {
            sp.delete('tripId');
            sp.delete('vehicleId');
        }

        window.history.replaceState({}, '', url.toString());
    }, [selectedStopId, selectedTripId, selectedVehicleId]);

    // --- 3. CAMERA FOLLOW ---
    useEffect(() => {
        if (!mapRef.current) {
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
            currentMap.flyTo({
                center: coords as [number, number],
                zoom: MAP_VEHICLE_SELECT_ZOOM,
                duration: MAP_ANIMATION_DURATION,
                essential: true,
                padding
            });
            return;
        }

        if (isFollowing && hasCoords) {
            currentMap.easeTo({
                center: coords as [number, number],
                duration: MAP_EASE_DURATION,
                essential: true,
                padding
            });
            return;
        }

        if (!isFollowing && !selectedTripId && selectedStop?.coordinates && lastFlownStopId.current !== selectedStopId) {
            lastFlownStopId.current = selectedStopId || null;
            currentMap.easeTo({
                center: selectedStop.coordinates,
                zoom: Math.max(currentMap.getZoom(), MAP_MIN_STOP_ZOOM),
                duration: MAP_EASE_DURATION,
                padding
            });
        }
    }, [selectedVehicle?.geometry?.coordinates, isFollowing, mapRef, selectedStop?.coordinates, selectedTripId, selectedVehicleId, selectedStopId, isMobile]);

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
                    if (map.getLayer('selected-vehicle-pulse')) {
                        map.setPaintProperty('selected-vehicle-pulse', 'circle-radius', radius);
                        map.setPaintProperty('selected-vehicle-pulse', 'circle-opacity', Math.max(0.1, opacity));
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
            if (map && map.getLayer('selected-vehicle-pulse')) {
                try {
                    map.setPaintProperty('selected-vehicle-pulse', 'circle-radius', 0);
                    map.setPaintProperty('selected-vehicle-pulse', 'circle-opacity', 0);
                } catch {
                    /* Silent fail */
                }
            }
        };
    }, [selectedVehicle, mapRef]);
};
