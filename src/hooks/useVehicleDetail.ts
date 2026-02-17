import { useQuery } from '@tanstack/react-query';
import type { VehicleDetail } from '../types/transit';
import { API_ENDPOINTS, REFRESH_INTERVALS } from '../config/api';

const fetchVehicleDetail = async (vehicleId: string, tripId: string): Promise<VehicleDetail> => {
    const res = await fetch(`${API_ENDPOINTS.VEHICLE_DETAIL}?vehicleId=${vehicleId}&tripId=${tripId}`);
    if (!res.ok) throw new Error('Failed to fetch vehicle detail');
    return res.json();
};

export const useVehicleDetail = (vehicleId: string | null, tripId: string | null) => {
    return useQuery({
        queryKey: ['vehicle-detail', vehicleId, tripId],
        queryFn: () => fetchVehicleDetail(vehicleId!, tripId!),
        enabled: !!vehicleId && !!tripId,
        staleTime: REFRESH_INTERVALS.VEHICLE_DETAIL,
        refetchInterval: REFRESH_INTERVALS.VEHICLE_DETAIL,
        gcTime: 60000,
    });
};
