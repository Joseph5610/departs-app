import { useMemo } from 'react';
import { useSelection } from '../../state/MapStateProvider';
import { useVehicles } from '../data/useVehicles';
import { useVehicleDetail } from '../data/useVehicleDetail';
import type { VehicleDetail } from '../../types/transit';

/**
 * useSelectedVehicle
 *
 * A derived data hook that merges multiple vehicle data sources on the fly:
 * 1. Current State (IDs from reducer)
 * 2. Live Stream (high-frequency location from useVehicles)
 * 3. Detail API (low-frequency metadata from useVehicleDetail)
 *
 * Returns a GeoJSON Feature representing the selected vehicle.
 */
export const useSelectedVehicle = () => {
    const { state } = useSelection();
    const { selectedTripId: tripId, selectedVehicleId: vehicleId } = state;

    const { vehicles: rawVehicles } = useVehicles();
    const { data: vehicleDetail } = useVehicleDetail();

    return useMemo((): VehicleDetail | null => {
        if (!tripId) {
            return null;
        }

        const liveMatch = rawVehicles?.features?.find(f => vehicleId ? f.properties.vehicle_id === vehicleId : f.properties.gtfs_trip_id === tripId);

        const isFallback = !!vehicleDetail?.properties?.is_static_fallback;

        const mergedProperties = {
            vehicle_id: vehicleId,
            gtfs_trip_id: tripId,
            bearing: null as number | null,
            delay: 0,
            ...liveMatch?.properties,
            ...vehicleDetail?.properties,
        };

        if (isFallback && liveMatch) {
            mergedProperties.delay = liveMatch.properties.delay;
            mergedProperties.bearing = liveMatch.properties.bearing ?? null;
            mergedProperties.state_position = liveMatch.properties.state_position;
            mergedProperties.last_stop_sequence = liveMatch.properties.last_stop_sequence;
        }

        let geometry = vehicleDetail?.geometry;

        const isValid = (g: any) => g?.coordinates && (g.coordinates[0] !== 0 || g.coordinates[1] !== 0);

        if (!isValid(geometry) && isValid(liveMatch?.geometry)) {
            geometry = liveMatch!.geometry;
        }

        if (!geometry) {
            return null;
        }

        return {
            type: 'Feature',
            geometry: geometry,
            properties: mergedProperties as any
        };
    }, [tripId, vehicleId, rawVehicles, vehicleDetail]);
};
