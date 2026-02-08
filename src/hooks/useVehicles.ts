
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { VehicleCollection } from '../types/pid';

// 1. Fetcher now returns raw feature arrays (deduplication happens in select)
const fetchRawVehicles = async (bounds: string | null, trackedId: string | null): Promise<any[]> => {
    const promises: Promise<Response>[] = [];

    if (bounds) promises.push(fetch(`/api/vehicles?bounds=${bounds}`));
    if (trackedId) promises.push(fetch(`/api/vehicles?tripId=${trackedId}`));

    if (promises.length === 0) return [];

    try {
        const responses = await Promise.all(promises);
        const jsons = await Promise.all(responses.map(r => r.ok ? r.json() : { features: [] }));
        return jsons.flatMap((j: any) => j.features || []);
    } catch (e) {
        console.error("Error fetching vehicles:", e);
        return [];
    }
};

export const useVehicles = (bounds: string | null, trackedId: string | null = null) => {
    // 2. Select function to transform and deduplicate data
    // Use useCallback to ensure the function reference is stable
    const selectFn = useCallback((allFeatures: any[]): VehicleCollection => {
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
    }, []);

    return useQuery({
        queryKey: ['vehicles', bounds, trackedId],
        queryFn: () => fetchRawVehicles(bounds, trackedId),
        select: selectFn,
        enabled: !!bounds || !!trackedId,
        refetchInterval: 10000,
        staleTime: 5000,
        gcTime: 60000,
        placeholderData: keepPreviousData,
        refetchOnMount: false,
        refetchOnReconnect: false,
    });
};
