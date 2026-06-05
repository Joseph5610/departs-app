import { useMemo } from 'react';
import { useRouteParams } from '../useRouteParams';
import { useVehicles } from '../data/useVehicles';
import { useVehicleDetail } from '../data/useVehicleDetail';
import type { VehicleDetail } from '../../types/transit';

/**
 * useSelectedVehicle
 *
 * A derived data hook that merges multiple vehicle data sources on the fly:
 * 1. Current Route (IDs from URL)
 * 2. Live Stream (high-frequency location from useVehicles)
 * 3. Detail API (low-frequency metadata from useVehicleDetail)
 */
export const useSelectedVehicle = () => {
    const { tripId, vehicleId } = useRouteParams();

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
            route_short_name: vehicleDetail?.route_short_name || liveMatch?.properties.route_short_name || '',
            route_type: vehicleDetail?.route_type ?? liveMatch?.properties.route_type ?? '',
            trip_headsign: vehicleDetail?.trip_headsign || liveMatch?.properties.trip_headsign || '',
            route_color: vehicleDetail?.route_color || liveMatch?.properties.route_color || '',
            is_night: vehicleDetail?.is_night ?? liveMatch?.properties.is_night ?? false,
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

        const isValid = (g: VehicleDetail['geometry'] | undefined) => g?.coordinates && (g.coordinates[0] !== 0 || g.coordinates[1] !== 0);

        if (isValid(vehicleDetail?.geometry)) {
            merged.geometry = vehicleDetail!.geometry;
        } else if (isValid(liveMatch?.geometry)) {
            merged.geometry = liveMatch!.geometry;
        }

        return merged;
    }, [tripId, vehicleId, rawVehicles, vehicleDetail]);
};
