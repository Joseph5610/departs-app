import type { StoredEnrichmentPatch } from '../types/enrichment';
import type { Departure, VehicleCollection, VehicleFeature, VehicleProperties } from '../types/transit';
import { DEPARTURES_CONFIG, ENRICHMENT_SILENCE_TTL_MS } from '../config/constants';

type PatchIndex = Map<string, StoredEnrichmentPatch>;

const META_KEYS = new Set<keyof StoredEnrichmentPatch>([
    'tripId',
    'vehicleId',
    'dataTimestamp',
    'receivedAt'
]);

export function applyEnrichment<T extends object>(
    base: T,
    tripId: string | undefined | null,
    vehicleId: string | undefined | null,
    byTripId: Map<string, StoredEnrichmentPatch>,
    byVehicleId: Map<string, StoredEnrichmentPatch>,
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

    // Gate 2: Silence check (defensive, should be handled by store prune)
    const now = baseTimestamp || Date.now();
    if (now - patch.receivedAt > ENRICHMENT_SILENCE_TTL_MS) {
        return base;
    }

    // Always apply patch fields to base because WS is the primary realtime authority.
    // The enrichmentStore prunes stale patches after 90s.
    const enriched = { ...base };
    let applied = false;

    const patchKeys = Object.keys(patch) as Array<keyof StoredEnrichmentPatch>;
    for (const key of patchKeys) {
        // Skip meta keys
        if (META_KEYS.has(key)) continue;

        const patchValue = patch[key];
        if (patchValue == null) continue;

        // Handle nesting for Vehicle properties
        if (key === 'is_wheelchair_accessible' || key === 'is_air_conditioned') {
            if (!('scheduled' in enriched)) {
                // It's a VehicleDetail (no 'scheduled' field), nest it
                const mut = enriched as Record<string, unknown>;
                if (!mut.vehicle_descriptor) mut.vehicle_descriptor = {};
                (mut.vehicle_descriptor as Record<string, unknown>)[key] = patchValue;
                applied = true;
                continue;
            }
        }

        const mut = enriched as Record<string, unknown>;
        mut[key] = patchValue;
        applied = true;
    }

    const mut = enriched as Record<string, unknown>;

    // Special case for Departures: If we updated the delay, we MUST recalculate the realtime timestamp
    // otherwise the countdown timers will not move.
    if (applied && typeof mut.scheduled === 'string' && typeof mut.delay === 'number') {
        const scheduledMs = new Date(mut.scheduled).getTime();
        mut.timestamp = new Date(scheduledMs + (mut.delay * 1000)).toISOString();
    }

    if (applied) {
        mut.is_enriched = true;
    }

    return applied ? enriched : base;
}

/** The ID a push patch is keyed by; feeds without vehicle IDs are matched by fleet number. */
const patchVehicleId = (p: VehicleProperties): string | undefined =>
    p.vehicle_id || p.vehicle_descriptor?.vehicle_registration_number?.toString() || undefined;

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
        const properties = applyEnrichment(f.properties, f.properties.gtfs_trip_id, patchVehicleId(f.properties), byTripId, byVehicleId, baseTimestamp);
        if (properties === f.properties) return f;
        changed = true;
        return { ...f, properties };
    });

    return changed ? { ...collection, features } : collection;
}

/**
 * Applies push patches to departures and drops those whose expected time is past the grace period.
 * `tripIndex` supplies the vehicle ID from the live stream when the departures response lacks it.
 */
export function enrichDepartures(
    departures: Departure[],
    tripIndex: Map<string, VehicleFeature>,
    byTripId: PatchIndex,
    byVehicleId: PatchIndex,
    baseTimestamp: number,
): Departure[] {
    const cutoff = baseTimestamp - DEPARTURES_CONFIG.PAST_GRACE_MS;
    const result: Departure[] = [];

    for (const dep of departures) {
        const vehicleId = dep.vehicleId || (dep.tripId ? tripIndex.get(dep.tripId)?.properties.vehicle_id : undefined) || undefined;
        let enriched = applyEnrichment(dep, dep.tripId, vehicleId, byTripId, byVehicleId, baseTimestamp);
        if (vehicleId && !enriched.vehicleId) {
            enriched = { ...enriched, vehicleId };
        }
        if (new Date(enriched.timestamp).getTime() >= cutoff) {
            result.push(enriched);
        }
    }

    return result;
}
