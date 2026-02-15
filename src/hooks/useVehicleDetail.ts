import { useQuery } from '@tanstack/react-query';
import type { VehicleDetail } from '../types/transit';
import { API_ENDPOINTS } from '../config/api';

const fetchVehicleDetail = async (vehicleId: string, tripId: string): Promise<VehicleDetail> => {
    const res = await fetch(API_ENDPOINTS.VEHICLE_DETAIL(vehicleId, tripId));
    if (!res.ok) throw new Error('Failed to fetch vehicle detail');
    return res.json();
};

export const useVehicleDetail = (vehicleId: string | null, tripId: string | null) => {
    return useQuery({
        queryKey: ['vehicle-detail', vehicleId, tripId],
        queryFn: () => fetchVehicleDetail(vehicleId!, tripId!),
        enabled: !!vehicleId && !!tripId,
        staleTime: 10000,
        refetchInterval: 10000, // 10s - matches vehicle update frequency
        gcTime: 60000,
    });
};
