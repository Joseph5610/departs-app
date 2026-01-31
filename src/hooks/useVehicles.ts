import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { VehicleCollection } from '../types/pid';

const fetchVehicles = async (bounds: string | null, trackedId: string | null): Promise<VehicleCollection> => {
    const promises: Promise<Response>[] = [];

    // Always fetch bounds if available (background traffic)
    if (bounds) {
        promises.push(fetch(`/api/vehicles?bounds=${bounds}`));
    }

    // Always fetch tracked vehicle if available (ensures it doesn't disappear)
    if (trackedId) {
        promises.push(fetch(`/api/vehicles?tripId=${trackedId}`));
    }

    if (promises.length === 0) return { type: 'FeatureCollection', features: [] };

    try {
        const responses = await Promise.all(promises);
        const jsons = await Promise.all(responses.map(r => r.ok ? r.json() : { features: [] }));

        // Merge features from all responses
        const allFeatures = jsons.flatMap((j: any) => j.features || []);

        // Deduplicate by vehicle_id (or id)
        const seen = new Set();
        const uniqueFeatures = [];
        for (const f of allFeatures) {
            const id = f.properties.vehicle_id || f.properties.id;
            if (!seen.has(id)) {
                seen.add(id);
                uniqueFeatures.push(f);
            }
        }

        return {
            type: 'FeatureCollection',
            features: uniqueFeatures as any
        };
    } catch (e) {
        console.error("Error fetching vehicles:", e);
        return { type: 'FeatureCollection', features: [] };
    }
};

export const useVehicles = (bounds: string | null, trackedId: string | null = null) => {
    return useQuery({
        queryKey: ['vehicles', bounds, trackedId],
        queryFn: () => fetchVehicles(bounds, trackedId),
        enabled: !!bounds || !!trackedId,
        refetchInterval: 10000,
        staleTime: 5000,
        gcTime: 60000,
        placeholderData: keepPreviousData,
        refetchOnMount: false,
        refetchOnReconnect: false,
    });
};
