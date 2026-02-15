import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { VehicleCollection, VehicleFeature } from '../types/transit';
import { API_ENDPOINTS } from '../config/api';

const fetchRawVehicles = async (bounds: string | null, trackedId: string | null, routeFilter: string[] | null): Promise<VehicleFeature[]> => {
    try {
        if (!bounds && !trackedId && (!routeFilter || routeFilter.length === 0)) return [];

        const url = API_ENDPOINTS.VEHICLES(bounds, trackedId, routeFilter);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const json = await response.json();
        return json.features || [];
    } catch {
        return [];
    }
};

export const useVehicles = (bounds: string | null, trackedId: string | null = null, routeFilter: string[] | null = null) => {
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
        queryKey: ['vehicles', bounds, trackedId, routeFilter],
        queryFn: () => fetchRawVehicles(bounds, trackedId, routeFilter),
        select: selectFn,
        enabled: !!bounds || !!trackedId || (!!routeFilter && routeFilter.length > 0),
        refetchInterval: 10000,
        staleTime: 5000,
        gcTime: 60000,
        placeholderData: keepPreviousData,
        refetchOnMount: false,
        refetchOnReconnect: false,
    });
};
