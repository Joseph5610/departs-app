import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { VehicleCollection, VehicleFeature } from '../types/transit';

const fetchRawVehicles = async (bounds: string | null, trackedId: string | null): Promise<VehicleFeature[]> => {
    try {
        let url = '';

        if (bounds && trackedId) {
            url = `/api/vehicles?bounds=${bounds}&tripId=${trackedId}`;
        } else if (bounds) {
            url = `/api/vehicles?bounds=${bounds}`;
        } else if (trackedId) {
            url = `/api/vehicles?tripId=${trackedId}`;
        }

        if (!url) return [];

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const json = await response.json();
        return json.features || [];
    } catch {
        return [];
    }
};

export const useVehicles = (bounds: string | null, trackedId: string | null = null) => {
    /**
     * Consumes "map-ready" data from the backend.
     * Deduplication and jittering are now handled in /api/vehicles.
     */
    const selectFn = useCallback((allFeatures: VehicleFeature[]): VehicleCollection => {
        return {
            type: 'FeatureCollection',
            features: allFeatures
        };
    }, []);

    return useQuery<VehicleFeature[], Error, VehicleCollection>({
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
