import { useMemo } from 'react';
import { useMap } from './useMap';
import { useVehicles } from './useVehicles';
import { useVehicleDetail } from './useVehicleDetail';
import type { VehicleDetail } from '../types/transit';

/**
 * useSelectedVehicle
 *
 * A derived data hook that merges multiple vehicle data sources on the fly:
 * 1. Current State (IDs from reducer)
 * 2. Live Stream (high-frequency location from useVehicles)
 * 3. Detail API (low-frequency metadata from useVehicleDetail)
 */
export const useSelectedVehicle = () => {
    const { state } = useMap();
    const { selectedTripId: tripId, selectedVehicleId: vehicleId } = state;

    const { vehicles: rawVehicles } = useVehicles();
    const { data: vehicleDetail } = useVehicleDetail();

    return useMemo((): VehicleDetail | null => {
        if (!tripId) {
            return null;
        }

        const liveMatch = rawVehicles?.features?.find(f => vehicleId ? f.properties.vehicle_id === vehicleId : f.properties.gtfs_trip_id === tripId);

        const isFallback = !!vehicleDetail?.is_static_fallback;

        const merged: VehicleDetail = {
            vehicle_id: vehicleId,
            gtfs_trip_id: tripId,
            bearing: null,
            delay: 0,
            ...liveMatch?.properties,
            ...vehicleDetail,
        };

        if (isFallback && liveMatch) {
            merged.delay = liveMatch.properties.delay;
            merged.bearing = liveMatch.properties.bearing;
            merged.state_position = liveMatch.properties.state_position;
            merged.last_stop_sequence = liveMatch.properties.last_stop_sequence;
        }

        const isValid = (g: any) => g?.coordinates && (g.coordinates[0] !== 0 || g.coordinates[1] !== 0);

        if (isValid(vehicleDetail?.geometry)) {
            merged.geometry = vehicleDetail!.geometry;
        } else if (isValid(liveMatch?.geometry)) {
            merged.geometry = liveMatch!.geometry;
        }

        return merged;
    }, [tripId, vehicleId, rawVehicles, vehicleDetail]);
};
