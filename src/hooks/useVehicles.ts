import { useQuery } from '@tanstack/react-query';
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
        refetchInterval: 5000,
        staleTime: 4000,
        refetchOnMount: false,
        refetchOnReconnect: false,
    });
};
