import type { StoredEnrichmentPatch } from '../types/enrichment';
import { ENRICHMENT_SILENCE_TTL_MS } from '../config/constants';

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
