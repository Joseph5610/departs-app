import type { StoredEnrichmentPatch } from '../../types/enrichment';
import type { VehicleCollection, VehicleFeature } from '../../types/transit';
import { ENRICHMENT_SILENCE_TTL_MS } from '../../config/constants';

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
    let patch: StoredEnrichmentPatch | undefined;

    if (tripId && byTripId.has(tripId)) {
        patch = byTripId.get(tripId);
    } else if (vehicleId && byVehicleId.has(vehicleId)) {
        patch = byVehicleId.get(vehicleId);
    }

    if (!patch) {
        return base;
    }

    const now = baseTimestamp || Date.now();
    if (now - patch.receivedAt > ENRICHMENT_SILENCE_TTL_MS) {
        return base;
    }

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
        const scheduledMs = new Date(mut.scheduled).getTime();
        mut.timestamp = new Date(scheduledMs + (mut.delay * 1000)).toISOString();
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

    let changed = false;
    const features = collection.features.map((f): VehicleFeature => {
        const properties = applyEnrichment(f.properties, f.properties.gtfs_trip_id, f.properties.vehicle_id || undefined, byTripId, byVehicleId, baseTimestamp);
        if (properties === f.properties) return f;
        changed = true;
        return { ...f, properties };
    });

    return changed ? { ...collection, features } : collection;
}
