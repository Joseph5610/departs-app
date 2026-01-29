import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { VehicleCollection } from '../types/pid';

const fetchVehicles = async (bounds: string): Promise<VehicleCollection> => {
    const res = await fetch(`/api/vehicles?bounds=${bounds}`);
    if (!res.ok) throw new Error('Failed to fetch vehicles');
    return res.json();
};

export const useVehicles = (bounds: string | null) => {
    return useQuery({
        queryKey: ['vehicles', bounds],
        queryFn: () => fetchVehicles(bounds!),
        enabled: !!bounds,
        refetchInterval: 15000,
        staleTime: 12000,
        gcTime: 60000,
        placeholderData: keepPreviousData,
        refetchOnMount: false,
        refetchOnReconnect: false,
    });
};
