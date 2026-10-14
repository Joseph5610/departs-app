import type { StoredEnrichmentPatch, VehicleCollection, VehicleDetail, VehicleFeature, VehicleProperties } from '@/types';
import { addSecondsToTime } from '@/domain/time';
import { ENRICHMENT_CONFIG } from '@/config/constants';
import { mapStable } from '@/lib/memoize';

export type PatchIndex = Map<string, StoredEnrichmentPatch>;

const META_KEYS = new Set<keyof StoredEnrichmentPatch>([
    'tripId',
    'vehicleId',
    'dataTimestamp',
    'receivedAt',
    'isEstimate',
]);

/** Realtime times of the stops from `fromSequence` on, moved to the timetable plus `delay`, as the backend derives them. */
function shiftUpcomingStops(stopTimes: NonNullable<VehicleDetail['stop_times']>, fromSequence: number, delay: number): NonNullable<VehicleDetail['stop_times']> {
    const features = mapStable(stopTimes.features, (f) => {
        const p = f.properties;
        if (p.stop_sequence < fromSequence) return f;
        const realtime_arrival_time = p.arrival_time ? addSecondsToTime(p.arrival_time, delay) : p.realtime_arrival_time;
        const realtime_departure_time = p.departure_time ? addSecondsToTime(p.departure_time, delay) : p.realtime_departure_time;
        if (realtime_arrival_time === p.realtime_arrival_time && realtime_departure_time === p.realtime_departure_time) return f;
        return { ...f, properties: { ...p, realtime_arrival_time, realtime_departure_time } };
    });
    return features === stopTimes.features ? stopTimes : { ...stopTimes, features };
}

/**
 * Applies the push patch for a trip (or else its vehicle) over `base`; the push stream is the realtime
 * authority. Returns `base` itself when no fresh patch applies.
 */
export function applyEnrichment<T extends object>(
    base: T,
    tripId: string | undefined | null,
    vehicleId: string | undefined | null,
    byTripId: PatchIndex,
    byVehicleId: PatchIndex,
    baseTimestamp: number,
): T {
    const patch = (tripId && byTripId.get(tripId)) || (vehicleId && byVehicleId.get(vehicleId)) || undefined;
    if (!patch || (baseTimestamp || Date.now()) - patch.receivedAt > ENRICHMENT_CONFIG.SILENCE_TTL_MS) return base;

    const enriched = { ...base };
    const mut = enriched as Record<string, unknown>;
    let applied = false;

    const patchKeys = Object.keys(patch) as Array<keyof StoredEnrichmentPatch>;
    for (const key of patchKeys) {
        if (META_KEYS.has(key)) continue;

        const patchValue = patch[key];
        if (patchValue == null) continue;

        // A VehicleDetail (no `scheduled`) keeps these under `vehicle_descriptor`.
        if ((key === 'is_wheelchair_accessible' || key === 'is_air_conditioned') && !('scheduled' in enriched)) {
            mut.vehicle_descriptor = { ...(mut.vehicle_descriptor as object | undefined), [key]: patchValue };
            applied = true;
            continue;
        }

        mut[key] = patchValue;
        applied = true;
    }

    if (!applied) return base;

    // A departure's countdown runs off `timestamp`, so it must follow a patched delay.
    if (typeof mut.scheduled === 'string' && typeof mut.delay === 'number') {
        mut.timestamp = new Date(Date.parse(mut.scheduled) + mut.delay * 1000).toISOString();
    }
    // A trip detail's upcoming stops carry realtime times derived from the delay; they must follow it too.
    // Without a live stop sequence the stops already served are unknown, so none are moved.
    if ('stop_times' in enriched && typeof mut.delay === 'number' && 'delay' in patch && patch.delay != null) {
        const detail = enriched as unknown as VehicleDetail;
        if (detail.stop_times && detail.last_stop_sequence != null && !detail.is_static_fallback) {
            detail.stop_times = shiftUpcomingStops(detail.stop_times, detail.last_stop_sequence, mut.delay);
        }
    }

    if (patch.isEstimate) mut.is_delay_estimated = true;
    else mut.is_enriched = true;
    return enriched;
}

/**
 * Applies push patches to every vehicle. Returns the input collection itself when no patch applies,
 * so consumers keyed on its identity don't recompute.
 */
export function enrichVehicleCollection(
    collection: VehicleCollection | null | undefined,
    byTripId: PatchIndex,
    byVehicleId: PatchIndex,
    baseTimestamp: number,
): VehicleCollection | null {
    if (!collection) return null;
    if (!collection.features?.length) return collection;

    const features = mapStable(collection.features, (f) => {
        const properties = applyEnrichment(f.properties, f.properties.gtfs_trip_id, f.properties.vehicle_id || undefined, byTripId, byVehicleId, baseTimestamp);
        return properties === f.properties ? f : { ...f, properties };
    });
    return features === collection.features ? collection : { ...collection, features };
}

/** A trip's current live properties from the fleet stream, or undefined if it isn't running right now. */
export const liveOf = (tripId: string, tripIndex: Map<string, VehicleFeature>): VehicleProperties | undefined =>
    tripIndex.get(tripId)?.properties;
