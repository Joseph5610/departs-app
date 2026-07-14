import { useMemo } from 'react';
import { useRouteParams } from '../useRouteParams';
import { useVehicles } from '../data/useVehicles';
import { useVehicleDetail } from '../data/useVehicleDetail';
import type { VehicleDetail } from '../../types/transit';
import { applyEnrichment } from '../../lib/enrichment';
import { useEnrichmentStore } from '../../state/enrichmentStore';

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

    const { vehicles: rawVehicles, dataUpdatedAt: vehiclesUpdatedAt } = useVehicles();
    const { data: vehicleDetail, dataUpdatedAt: detailUpdatedAt } = useVehicleDetail();

    const byTripId = useEnrichmentStore(s => s.byTripId);
    const byVehicleId = useEnrichmentStore(s => s.byVehicleId);

    return useMemo((): VehicleDetail | null => {
        if (!tripId) {
            return null;
        }

        const liveMatch = rawVehicles?.features?.find(f => vehicleId ? f.properties.vehicle_id === vehicleId : f.properties.gtfs_trip_id === tripId);

        const isFallback = !!vehicleDetail?.is_static_fallback;

        const merged: VehicleDetail = {
            ...liveMatch?.properties,
            ...vehicleDetail,
            vehicle_id: vehicleId || liveMatch?.properties.vehicle_id || vehicleDetail?.vehicle_id || null,
            gtfs_trip_id: tripId,
            route_short_name: vehicleDetail?.route_short_name || liveMatch?.properties.route_short_name || '',
            route_type: vehicleDetail?.route_type ?? liveMatch?.properties.route_type ?? '',
            trip_headsign: vehicleDetail?.trip_headsign || liveMatch?.properties.trip_headsign || '',
            route_color: vehicleDetail?.route_color || liveMatch?.properties.route_color || '',
            is_night: vehicleDetail?.is_night ?? liveMatch?.properties.is_night ?? false,
            bearing: vehicleDetail?.bearing ?? liveMatch?.properties.bearing ?? null,
            delay: vehicleDetail?.delay ?? liveMatch?.properties.delay ?? null,
        };

        // If vehicleDetail returned delay: null, it clobbered our delay: 0 fallback.
        // But we want to ensure we don't have undefined delay before enrichment.
        if (merged.delay === undefined) {
            merged.delay = null;
        }

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

        const baseTs = Math.max(vehiclesUpdatedAt || 0, detailUpdatedAt || 0);
        return applyEnrichment(merged, merged.gtfs_trip_id, merged.vehicle_id, byTripId, byVehicleId, baseTs);
    }, [tripId, vehicleId, rawVehicles, vehicleDetail, byTripId, byVehicleId, vehiclesUpdatedAt, detailUpdatedAt]);
};
