import type { VehicleDetail, VehicleFeature, StoredEnrichmentPatch, RouteInfo, VehicleMetadata } from '@/types';
import { applyEnrichment } from '@/domain/realtime/patches';
import { enrichConnections } from './enrich';
import { hasPosition } from '@/lib/geo';
import type { RouteLookup } from '@/domain/routes/metadata';

/**
 * The selected vehicle merged from its sources: detail API over live stream over the route's IDs. A
 * static-fallback detail keeps the live position and delay. Push patches apply last.
 */
export const mergeSelectedVehicle = (
    tripId: string | null,
    vehicleId: string | null,
    vehicleIndex: Map<string, VehicleFeature>,
    tripIndex: Map<string, VehicleFeature>,
    vehicleDetail: VehicleDetail | undefined,
    byTripId: Map<string, StoredEnrichmentPatch>,
    byVehicleId: Map<string, StoredEnrichmentPatch>,
    byShortName: RouteLookup,
    byId: Map<string, RouteInfo>,
    metadata: VehicleMetadata | undefined,
    vehiclesUpdatedAt: number,
    detailUpdatedAt: number,
): VehicleDetail | null => {
    if (!tripId) return null;

    const candidate = vehicleId ? vehicleIndex.get(vehicleId) : tripIndex.get(tripId);
    // A vehicle id can outlive its trip; its next trip's live data must not leak into this one.
    const liveMatch = candidate?.properties.gtfs_trip_id && candidate.properties.gtfs_trip_id !== tripId ? undefined : candidate;

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

    if (vehicleDetail?.is_static_fallback && liveMatch) {
        merged.delay = liveMatch.properties.delay;
        merged.bearing = liveMatch.properties.bearing;
        merged.state_position = liveMatch.properties.state_position;
        if (liveMatch.properties.last_stop_sequence !== undefined) {
            merged.last_stop_sequence = liveMatch.properties.last_stop_sequence;
        }
    }

    const geometry = [vehicleDetail?.geometry, liveMatch?.geometry].find((g) => hasPosition(g?.coordinates));
    if (geometry) merged.geometry = geometry;

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
};
