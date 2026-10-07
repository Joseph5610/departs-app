import type { StoredEnrichmentPatch, VehicleCollection, VehicleFeature, VehicleProperties } from '@/types';
import { ENRICHMENT_CONFIG } from '@/config/constants';
import { mapStable } from '@/lib/memoize';

export type PatchIndex = Map<string, StoredEnrichmentPatch>;

const META_KEYS = new Set<keyof StoredEnrichmentPatch>([
    'tripId',
    'vehicleId',
    'dataTimestamp',
    'receivedAt'
]);

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

    mut.is_enriched = true;
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
