import { useEffect, useRef } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import type { VehicleDetail, SelectedStop } from '../types/transit';
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
 * Handles UI/UX side effects based on map state:
 * 1. URL synchronization (Read/Write)
 * 2. Camera movement (Following vehicles or stops)
 * 3. Selected vehicle animations (Pulse effect)
 */
export const useMapInterface = (
    mapRef: React.RefObject<MapRef | null>,
    state: {
        selectedId: string | null;
        selectedVehicle: VehicleDetail | null;
        selectedStop: SelectedStop | null;
        isFollowing: boolean;
    },
    actions: {
        setSelectedStop: (stop: SelectedStop | null) => void;
        selectVehicle: (vehicle: VehicleDetail | null, keepStop?: boolean) => void;
    }
) => {
    const { selectedId, selectedVehicle, selectedStop, isFollowing } = state;
    const { setSelectedStop, selectVehicle } = actions;

    const initialized = useRef(false);
    const lastFlownId = useRef<string | null>(null);

    // --- 1. URL SYNC (Initial Load) ---
    useEffect(() => {
        if (initialized.current) {
            return;
        }
        const p = new URLSearchParams(window.location.search);

        const stopId = p.get('stopId');
        if (stopId && !selectedStop) {
            setSelectedStop({ stop_id: stopId, stop_name: '' });
        }

        const tripId = p.get('tripId');
        const vehicleId = p.get('vehicleId');
        if (tripId && !selectedVehicle) {
            selectVehicle({
                vehicle_id: vehicleId || null,
                gtfs_trip_id: tripId,
                state_position: 'on_track',
                geometry: { type: 'Point', coordinates: [0, 0] }
            } as VehicleDetail, !!stopId);
        }

        initialized.current = true;
    }, [setSelectedStop, selectedStop, selectedVehicle, selectVehicle]);

    // --- 2. URL SYNC (State Change) ---
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
        const coords = selectedVehicle?.geometry?.coordinates as [number, number] | undefined;
        const hasCoords = coords && (coords[0] !== 0 || coords[1] !== 0);

        // A) Initial "Fly To" when a vehicle is first found with coordinates
        if (isFollowing && hasCoords && lastFlownId.current !== currentId) {
            lastFlownId.current = currentId || null;
            currentMap.flyTo({
                center: coords,
                zoom: MAP_VEHICLE_SELECT_ZOOM,
                duration: MAP_ANIMATION_DURATION,
                essential: true,
                padding
            });
            return;
        }

        // B) Smooth "Ease To" for continuous following
        if (isFollowing && hasCoords) {
            currentMap.easeTo({
                center: coords,
                duration: 1000,
                essential: true,
                padding
            });
            return;
        }

        // C) Center on Stop if enriched and not following
        if (!isFollowing && selectedStop?.coordinates) {
            currentMap.easeTo({
                center: selectedStop.coordinates,
                zoom: Math.max(currentMap.getZoom(), 14),
                duration: 1000,
                padding
            });
        }
    }, [selectedVehicle?.geometry?.coordinates, isFollowing, mapRef, selectedStop?.coordinates, selectedId, selectedVehicle?.gtfs_trip_id]);

    // --- 4. PULSE ANIMATION ---
    useEffect(() => {
        let frame: number;
        const currentMapRef = mapRef.current;

        const animate = () => {
            const map = mapRef.current?.getMap();
            const coords = selectedVehicle?.geometry?.coordinates;
            if (map && coords && (coords[0] !== 0 || coords[1] !== 0)) {
                const time = Date.now() / 350;
                const radius = 20 + Math.sin(time) * 15;
                const opacity = 0.6 - ((radius - 5) / 50);

                try {
                    if (map.getLayer('selected-vehicle-pulse')) {
                        map.setPaintProperty('selected-vehicle-pulse', 'circle-radius', radius);
                        map.setPaintProperty('selected-vehicle-pulse', 'circle-opacity', Math.max(0.1, opacity));
                    }
                } catch { /* Fail silently */ }
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
                } catch { /* Fail silently */ }
            }
        };
    }, [selectedVehicle, mapRef]);
};
