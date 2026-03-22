import { useEffect, useRef } from 'react';
import { useMap } from './useMap';
import {
    MAP_VEHICLE_SELECT_ZOOM,
    MAP_ANIMATION_DURATION,
    MOBILE_BREAKPOINT,
    MOBILE_BOTTOM_SHEET_RATIO,
    SIDEBAR_WIDTH
} from '../config/constants';

/**
 * useMapInterface
 *
 * The "User Experience Layer" hook.
 *
 * It manages the bridge between the application's internal state and the physical map interface.
 * This hook is purely reactive—it observes state changes and triggers side effects like
 * camera movement, URL updates, and MapLibre animations.
 */
export const useMapInterface = () => {
    const { state, actions, mapRef } = useMap();
    const { selectedId, selectedVehicle, selectedStop, isFollowing } = state;
    const { updateStop, selectVehicle } = actions;

    const initialized = useRef(false);
    const lastFlownId = useRef<string | null>(null);

    // --- 1. URL SYNC (Initial Load) ---
    /**
     * Reads selection state from the URL on application startup.
     */
    useEffect(() => {
        if (initialized.current) {
            return;
        }
        const p = new URLSearchParams(window.location.search);

        const stopId = p.get('stopId');
        if (stopId && !selectedStop) {
            updateStop({ stop_id: stopId });
        }

        const tripId = p.get('tripId');
        const vehicleId = p.get('vehicleId');
        if (tripId && !selectedVehicle) {
            selectVehicle({
                vehicle_id: vehicleId || null,
                gtfs_trip_id: tripId,
                bearing: null,
                delay: 0
            } as any, !!stopId);
        }

        initialized.current = true;
    }, [updateStop, selectedStop, selectedVehicle, selectVehicle]);

    // --- 2. URL SYNC (Write) ---
    /**
     * Persists the current selection state back to the browser's URL.
     */
    useEffect(() => {
        const url = new URL(window.location.href);
        const sp = url.searchParams;

        if (selectedStop) {
            sp.set('stopId', selectedStop.stop_id);
        } else {
            sp.delete('stopId');
        }

        if (selectedVehicle) {
            if (selectedVehicle.vehicle_id) {
                sp.set('vehicleId', selectedVehicle.vehicle_id);
            } else {
                sp.delete('vehicleId');
            }
            sp.set('tripId', selectedVehicle.gtfs_trip_id);
        } else {
            sp.delete('vehicleId');
            sp.delete('tripId');
        }

        window.history.replaceState({}, '', url.toString());
    }, [selectedStop, selectedVehicle]);

    // --- 3. CAMERA FOLLOW ---
    /**
     * Manages the map camera based on selections and 'following' state.
     */
    useEffect(() => {
        if (!mapRef.current) {
            return;
        }

        const isMobile = typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false;
        const padding = isMobile
            ? { bottom: window.innerHeight / MOBILE_BOTTOM_SHEET_RATIO, top: 0, left: 0, right: 0 }
            : { bottom: 0, top: 0, left: SIDEBAR_WIDTH, right: 0 };

        const currentMap = mapRef.current;
        const currentId = selectedId || selectedVehicle?.gtfs_trip_id;
        const coords = selectedVehicle?.geometry?.coordinates;
        const hasCoords = coords && (coords[0] !== 0 || coords[1] !== 0);

        // A) Initial "Fly To" on selection
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

        // B) Continuous Ease To
        if (isFollowing && hasCoords) {
            currentMap.easeTo({
                center: coords as [number, number],
                duration: 1000,
                essential: true,
                padding
            });
            return;
        }

        // C) Center on Stop
        if (!isFollowing && selectedStop?.coordinates) {
            currentMap.easeTo({
                center: selectedStop.coordinates,
                zoom: Math.max(currentMap.getZoom(), 14),
                duration: 1000,
                padding
            });
        }
    }, [selectedVehicle?.geometry?.coordinates, isFollowing, mapRef, selectedStop?.coordinates, selectedId, selectedVehicle?.gtfs_trip_id]);

    // --- 4. PERFORMANCE VISUALS (NON-REACT) ---
    /**
     * Orchestrates high-frequency MapLibre animations directly to bypass React overhead.
     */
    useEffect(() => {
        let frame: number;
        const currentMapRef = mapRef.current;

        const animate = () => {
            const map = mapRef.current?.getMap();
            const coords = selectedVehicle?.geometry?.coordinates;
            const hasCoords = coords && (coords[0] !== 0 || coords[1] !== 0);

            if (map && hasCoords) {
                const time = Date.now() / 350;
                const radius = 20 + Math.sin(time) * 15;
                const opacity = 0.6 - ((radius - 5) / 50);

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
