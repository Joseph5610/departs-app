import { create } from 'zustand';
import type { EnrichmentPatch, StoredEnrichmentPatch } from '@/types';
import { ENRICHMENT_CONFIG } from '@/config/constants';

interface EnrichmentState {
    byTripId: Map<string, StoredEnrichmentPatch>;
    byVehicleId: Map<string, StoredEnrichmentPatch>;
    applyBatchedPatches: (patches: EnrichmentPatch[]) => void;
    clearAll: () => void;
    /** Drops patches older than ENRICHMENT_CONFIG.SILENCE_TTL_MS; run periodically by useEnrichmentChannel. */
    pruneExpired: () => void;
}

/** The patches heard from within the silence TTL; the map itself when none expired. */
const withoutExpired = (patches: Map<string, StoredEnrichmentPatch>, now: number): Map<string, StoredEnrichmentPatch> => {
    const fresh = new Map([...patches].filter(([, patch]) => now - patch.receivedAt <= ENRICHMENT_CONFIG.SILENCE_TTL_MS));
    return fresh.size === patches.size ? patches : fresh;
};

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
                const byTripId = withoutExpired(state.byTripId, now);
                const byVehicleId = withoutExpired(state.byVehicleId, now);
                return byTripId === state.byTripId && byVehicleId === state.byVehicleId ? state : { byTripId, byVehicleId };
            });
        },
    };
});
