import { useEffect } from 'react';
import type { VehicleCollection, TrackedVehicle, VehicleDetail } from '../types/transit';

/**
 * The 'Motor' of the map tracking system.
 * Keeps the selected vehicle state synchronized between two distinct data sources:
 * 1. MAP STREAM (rawVehicles): High-frequency GeoJSON updates (position, speed).
 * 2. DETAIL API (vehicleDetail): Low-frequency REST updates (operator, amenities, full schedule).
 * 
 * It ensures that even if a vehicle is re-jittered or updated in the background, 
 * the UI's selected state remains accurate.
 */
export const useMapVehicleSync = (
    selectedId: string | number | null,
    selectedVehicle: TrackedVehicle | null,
    setSelectedVehicle: (vehicle: TrackedVehicle | null | ((prev: TrackedVehicle | null) => TrackedVehicle | null)) => void,
    isFollowing: boolean,
    rawVehicles?: VehicleCollection | null,
    vehicleDetail?: VehicleDetail | null
) => {
    useEffect(() => {
        if (!selectedId || !selectedVehicle) return;

        const sid = String(selectedId);
        const stid = String(selectedVehicle.gtfs_trip_id || 'NONE');

        let updated = false;
        let newProps: Partial<TrackedVehicle> = {};
        let newCoords = selectedVehicle._geometry;

        // 1. Sync from high-frequency Map Stream
        // We look for the active vehicle in the latest GeoJSON batch from the map stream.
        // We match by vehicle_id (preferred) or gtfs_trip_id as a fallback.
        if (rawVehicles?.features) {
            const match = rawVehicles.features.find(f => {
                const props = f.properties;
                const fid = String(props.vehicle_id);
                const ftid = String(props.gtfs_trip_id || '');
                if (sid !== 'NONE' && !sid.startsWith('trip-')) return fid === sid;
                return ftid === stid && stid !== 'NONE';
            });

            if (match) {
                const p = match.properties;
                const coords = match.geometry.coordinates as [number, number];
                const matchId = String(p.vehicle_id);

                const hasValidLocation = coords[0] !== 0 || coords[1] !== 0;

                if (selectedVehicle._geometry[0] !== coords[0] || selectedVehicle.delay !== p.delay) {
                    updated = true;
                    newProps = { ...p, vehicle_id: sid.startsWith('trip-') ? matchId : sid };
                    // Only update coordinates if they are valid, or if we currently have invalid ones
                    if (hasValidLocation || (selectedVehicle._geometry[0] === 0 && selectedVehicle._geometry[1] === 0)) {
                        newCoords = coords;
                    }
                }
            }
        }

        // 2. Sync from Direct Detail API
        // If we have detailed info for the selected vehicle, use it to update position and properties.
        if (vehicleDetail?.geometry?.coordinates) {
            const detailCoords = vehicleDetail.geometry.coordinates as [number, number];
            const detailDelay = vehicleDetail.delay;
            const hasValidDetailLocation = detailCoords[0] !== 0 || detailCoords[1] !== 0;

            // Update if coordinates or delay changed in the detail API
            if (newCoords[0] !== detailCoords[0] || newCoords[1] !== detailCoords[1] || (newProps.delay !== undefined && newProps.delay !== detailDelay)) {
                updated = true;
                // Only update coordinates if they are valid, or if we currently have invalid ones
                if (hasValidDetailLocation || (newCoords[0] === 0 && newCoords[1] === 0)) {
                    newCoords = detailCoords;
                }
                newProps = {
                    ...newProps,
                    delay: detailDelay,
                    state_position: vehicleDetail.state_position || newProps.state_position,
                    vehicle_registration_number: vehicleDetail.vehicle_descriptor?.vehicle_registration_number || newProps.vehicle_registration_number
                };
            }
        }

        if (updated) {
            setSelectedVehicle((prev: TrackedVehicle | null) => prev ? { ...prev, ...newProps, _geometry: newCoords } as TrackedVehicle : null);
        }
    }, [rawVehicles, vehicleDetail, isFollowing, selectedId, selectedVehicle, setSelectedVehicle]);
};
