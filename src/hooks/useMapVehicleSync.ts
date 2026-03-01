import { useEffect, useRef } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import type { VehicleCollection, TrackedVehicle } from '../types/transit';
import { MAP_VEHICLE_SELECT_ZOOM, MAP_ANIMATION_DURATION, MOBILE_BREAKPOINT, MOBILE_BOTTOM_SHEET_RATIO, SIDEBAR_WIDTH } from '../config/constants';

/**
 * The 'Motor' of the map tracking system.
 * Keeps the selected vehicle state synchronized with the high-frequency MAP STREAM (rawVehicles).
 * It ensures that even if a vehicle is re-jittered or updated in the background, 
 * the UI's selected state remains accurate.
 *
 * NOTE: Metadata updates (delay, state) are ONLY synced from the map stream.
 * We do NOT merge properties from the low-frequency Detail API here to prevent race conditions.
 */
export const useMapVehicleSync = (
    mapRef: React.RefObject<MapRef | null>,
    selectedId: string | number | null,
    selectedVehicle: TrackedVehicle | null,
    setSelectedVehicle: (vehicle: TrackedVehicle | null | ((prev: TrackedVehicle | null) => TrackedVehicle | null)) => void,
    isFollowing: boolean,
    rawVehicles?: VehicleCollection | null
) => {
    const lastFlownId = useRef<string | null>(null);

    useEffect(() => {
        if (!selectedId || !selectedVehicle) return;

        const sid = String(selectedId);
        const stid = String(selectedVehicle.gtfs_trip_id || 'NONE');

        let updated = false;
        let newProps: Partial<TrackedVehicle> = {};
        let newCoords = selectedVehicle._geometry;

        // 1. Sync from high-frequency Map Stream
        if (rawVehicles?.features) {
            const match = rawVehicles.features.find(f => {
                const props = f.properties;
                const fid = String(props.vehicle_id);
                const ftid = String(props.gtfs_trip_id || '');
                if (sid !== 'NONE' && !sid.startsWith('trip-')) return fid === sid;
                return ftid === stid && stid !== 'NONE';
            });

            if (match && match.geometry) {
                const p = match.properties;
                const coords = match.geometry.coordinates as [number, number];
                const matchId = String(p.vehicle_id);

                const hasValidLocation = coords[0] !== 0 || coords[1] !== 0;

                if (selectedVehicle._geometry[0] !== coords[0] || selectedVehicle.delay !== p.delay) {
                    updated = true;
                    newProps = { ...p, vehicle_id: sid.startsWith('trip-') ? matchId : sid };
                    if (hasValidLocation || (selectedVehicle._geometry[0] === 0 && selectedVehicle._geometry[1] === 0)) {
                        newCoords = coords;
                    }
                }
            }
        }

        if (updated) {
            setSelectedVehicle((prev: TrackedVehicle | null) => prev ? { ...prev, ...newProps, _geometry: newCoords } as TrackedVehicle : null);
        }

        // Map movement: Focus on vehicle when coordinates are found
        const hasCoords = newCoords[0] !== 0 || newCoords[1] !== 0;
        const currentId = String(selectedId);
        if (hasCoords && lastFlownId.current !== currentId) {
            lastFlownId.current = currentId;
            const isMobile = typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false;
            mapRef.current?.flyTo({
                center: newCoords,
                zoom: MAP_VEHICLE_SELECT_ZOOM,
                duration: MAP_ANIMATION_DURATION,
                essential: true,
                padding: isMobile
                    ? { bottom: window.innerHeight / MOBILE_BOTTOM_SHEET_RATIO, top: 0, left: 0, right: 0 }
                    : { bottom: 0, top: 0, left: SIDEBAR_WIDTH, right: 0 }
            });
        }
    }, [rawVehicles, isFollowing, selectedId, selectedVehicle, setSelectedVehicle, mapRef]);
};
