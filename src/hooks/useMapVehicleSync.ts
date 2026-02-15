import { useEffect } from 'react';
import type { VehicleCollection, TrackedVehicle, VehicleDetail, VehicleProperties, LiteVehicleProperties } from '../types/transit';

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
    setSelectedVehicle: (vehicle: TrackedVehicle | null) => void,
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
                const props = f.properties as (VehicleProperties | LiteVehicleProperties);
                const fid = String('vehicle_id' in props ? props.vehicle_id : (props as LiteVehicleProperties).id || '');
                const ftid = String('gtfs_trip_id' in props ? props.gtfs_trip_id : (props as LiteVehicleProperties).tId || '');
                if (sid !== 'NONE' && !sid.startsWith('trip-')) return fid === sid;
                return ftid === stid && stid !== 'NONE';
            });

            if (match) {
                const p = match.properties as (VehicleProperties | LiteVehicleProperties);
                const coords = match.geometry.coordinates;
                const matchId = String('vehicle_id' in p ? p.vehicle_id : (p as LiteVehicleProperties).id);

                const currentDelay = 'delay' in p ? p.delay : (p as LiteVehicleProperties).d;
                if (selectedVehicle._geometry[0] !== coords[0] || selectedVehicle.delay !== currentDelay) {
                    updated = true;
                    newProps = { ...p, vehicle_id: sid.startsWith('trip-') ? matchId : sid } as Partial<TrackedVehicle>;
                    newCoords = coords;
                }
            }
        }

        // 2. Sync from Direct Detail API
        // For now, only syncing from stream. 
        // Detail sync can be added here if needed for extra info like operator.

        if (updated) {
            setSelectedVehicle({ ...selectedVehicle, ...newProps, _geometry: newCoords });
        }
    }, [rawVehicles, vehicleDetail, isFollowing, selectedId, selectedVehicle]);
};
