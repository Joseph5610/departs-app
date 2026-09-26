import { useRouteParams } from '../useRouteParams';
import { useVehicles } from '../data/useVehicles';
import { useVehicleDetail } from '../data/useVehicleDetail';
import { useRouteMetadata } from '../data/useRouteMetadata';
import { useFleetLookup } from '../data/useVehicleMetadata';
import type { VehicleDetail, VehicleFeature } from '../../types/transit';
import type { StoredEnrichmentPatch } from '../../types/enrichment';
import type { RouteInfo, VehicleMetadata } from '../../types/vehicles';
import { memoizeLast } from '../../lib/memoize';
import { applyEnrichment, enrichConnections } from '../../lib/enrichment';
import { useEnrichmentStore } from '../../state/enrichmentStore';

const mergeSelectedVehicle = memoizeLast((
    tripId: string | null,
    vehicleId: string | null,
    vehicleIndex: Map<string, VehicleFeature>,
    tripIndex: Map<string, VehicleFeature>,
    vehicleDetail: VehicleDetail | undefined,
    byTripId: Map<string, StoredEnrichmentPatch>,
    byVehicleId: Map<string, StoredEnrichmentPatch>,
    byShortName: Map<string, RouteInfo>,
    byId: Map<string, RouteInfo>,
    metadata: VehicleMetadata | undefined,
    vehiclesUpdatedAt: number,
    detailUpdatedAt: number,
): VehicleDetail | null => {
    if (!tripId) {
        return null;
    }

    let liveMatch = vehicleId ? vehicleIndex.get(vehicleId) : tripIndex.get(tripId);

    // If we matched the vehicle by ID but it has moved on to a different trip,
    // we ignore its live stream data so we cleanly fall back to the static schedule of the old trip.
    if (liveMatch && tripId && liveMatch.properties.gtfs_trip_id && liveMatch.properties.gtfs_trip_id !== tripId) {
        liveMatch = undefined;
    }

    const isFallback = !!vehicleDetail?.is_static_fallback;

    const merged: VehicleDetail = {
        ...liveMatch?.properties,
        ...vehicleDetail,
        state_position: vehicleDetail?.state_position ?? liveMatch?.properties.state_position ?? 'on_track',
        vehicle_id: vehicleId || liveMatch?.properties.vehicle_id || vehicleDetail?.vehicle_id || null,
        gtfs_trip_id: tripId,
        route_short_name: vehicleDetail?.route_short_name || liveMatch?.properties.route_short_name || '',
        route_type: vehicleDetail?.route_type ?? liveMatch?.properties.route_type ?? 'unknown',
        trip_headsign: vehicleDetail?.trip_headsign || liveMatch?.properties.trip_headsign || '',
        route_color: vehicleDetail?.route_color || liveMatch?.properties.route_color || '',
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
        if (liveMatch.properties.last_stop_sequence !== undefined) {
            merged.last_stop_sequence = liveMatch.properties.last_stop_sequence;
        }
    }

    const isValid = (g: VehicleDetail['geometry'] | undefined) => g?.coordinates && (g.coordinates[0] !== 0 || g.coordinates[1] !== 0);

    if (isValid(vehicleDetail?.geometry)) {
        merged.geometry = vehicleDetail!.geometry;
    } else if (isValid(liveMatch?.geometry)) {
        merged.geometry = liveMatch!.geometry;
    }

    if (metadata) {
        const descriptor = merged.vehicle_descriptor;
        merged.vehicle_descriptor = {
            ...descriptor,
            operator: metadata.operator,
            vehicle_type: metadata.vehicle_type ?? descriptor?.vehicle_type,
            is_air_conditioned: metadata.is_air_conditioned ?? descriptor?.is_air_conditioned,
            is_wheelchair_accessible: metadata.is_wheelchair_accessible ?? descriptor?.is_wheelchair_accessible,
        };
    }

    const stopTimes = merged.stop_times;
    if (stopTimes?.features) {
        const features = enrichConnections(stopTimes.features, tripIndex, byShortName, byId);
        if (features !== stopTimes.features) merged.stop_times = { ...stopTimes, features };
    }

    const baseTs = Math.max(vehiclesUpdatedAt || 0, detailUpdatedAt || 0);
    return applyEnrichment(merged, merged.gtfs_trip_id, merged.vehicle_id, byTripId, byVehicleId, baseTs);
});

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

    const { vehicleIndex, tripIndex, dataUpdatedAt: vehiclesUpdatedAt } = useVehicles();
    const { data: vehicleDetail, dataUpdatedAt: detailUpdatedAt } = useVehicleDetail();

    const byTripId = useEnrichmentStore(s => s.byTripId);
    const byVehicleId = useEnrichmentStore(s => s.byVehicleId);
    const { byShortName, byId } = useRouteMetadata();
    const metadata = useFleetLookup()?.(vehicleId ?? vehicleDetail?.vehicle_id);

    return mergeSelectedVehicle(tripId, vehicleId, vehicleIndex, tripIndex, vehicleDetail, byTripId, byVehicleId, byShortName, byId, metadata, vehiclesUpdatedAt, detailUpdatedAt);
};
