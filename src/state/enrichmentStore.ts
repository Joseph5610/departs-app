import { create } from 'zustand';
import type { EnrichmentPatch, StoredEnrichmentPatch } from '../types/enrichment';
import { ENRICHMENT_SILENCE_TTL_MS } from '../config/constants';

interface EnrichmentState {
    byTripId: Map<string, StoredEnrichmentPatch>;
    byVehicleId: Map<string, StoredEnrichmentPatch>;
    applyBatchedPatches: (patches: EnrichmentPatch[]) => void;
    clearAll: () => void;
    /** Drops patches older than ENRICHMENT_SILENCE_TTL_MS; run periodically by useEnrichmentChannel. */
    pruneExpired: () => void;
}

export const useEnrichmentStore = create<EnrichmentState>((set) => {
    return {
        byTripId: new Map(),
        byVehicleId: new Map(),

        applyBatchedPatches: (patches: EnrichmentPatch[]) => {
            if (patches.length === 0) return;
            set((state) => {
                const now = Date.now();
                const nextByTripId = new Map(state.byTripId);
                const nextByVehicleId = new Map(state.byVehicleId);
                let changed = false;

                for (const patch of patches) {
                    const storedPatch: StoredEnrichmentPatch = { ...patch, receivedAt: now };
                    if (patch.tripId) {
                        nextByTripId.set(patch.tripId, storedPatch);
                        changed = true;
                    }
                    if (patch.vehicleId) {
                        nextByVehicleId.set(patch.vehicleId, storedPatch);
                        changed = true;
                    }
                }

                if (changed) {
                    return {
                        byTripId: nextByTripId,
                        byVehicleId: nextByVehicleId,
                    };
                }

                return state;
            });
        },

        clearAll: () => {
            set({
                byTripId: new Map(),
                byVehicleId: new Map(),
            });
        },

        pruneExpired: () => {
            set((state) => {
                const now = Date.now();
                const nextByTripId = new Map(state.byTripId);
                const nextByVehicleId = new Map(state.byVehicleId);
                let changed = false;

                for (const [tripId, patch] of nextByTripId.entries()) {
                    if (now - patch.receivedAt > ENRICHMENT_SILENCE_TTL_MS) {
                        nextByTripId.delete(tripId);
                        changed = true;
                    }
                }

                for (const [vehicleId, patch] of nextByVehicleId.entries()) {
                    if (now - patch.receivedAt > ENRICHMENT_SILENCE_TTL_MS) {
                        nextByVehicleId.delete(vehicleId);
                        changed = true;
                    }
                }

                if (changed) {
                    return {
                        byTripId: nextByTripId,
                        byVehicleId: nextByVehicleId,
                    };
                }

                return state;
            });
        },
    };
});
