import { useQuery } from '@tanstack/react-query';
import type { VehicleDetail } from '../../types/transit';
import { useSelection } from '../../state/MapStateProvider';

const fetchVehicleDetail = async (vehicleId: string | null, tripId: string): Promise<VehicleDetail> => {
    const url = new URL('/api/vehicle-detail', window.location.origin);
    url.searchParams.set('tripId', tripId);
    if (vehicleId) {
        url.searchParams.set('vehicleId', vehicleId);
    }

    const res = await fetch(url.toString());
    if (!res.ok) {
        throw new Error('Failed to fetch vehicle detail');
    }
    return res.json();
};

export const useVehicleDetail = () => {
    const { state } = useSelection();
    const { selectedTripId: tripId, selectedVehicleId: vehicleId } = state;

    return useQuery({
        queryKey: ['vehicle-detail', vehicleId, tripId],
        queryFn: () => { return fetchVehicleDetail(vehicleId, tripId!); },
        enabled: !!tripId,
        staleTime: 10000,
        refetchInterval: 10000, // 10s - matches vehicle update frequency
        gcTime: 60000,
    });
};
