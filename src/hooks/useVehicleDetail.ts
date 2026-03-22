import { useQuery } from '@tanstack/react-query';
import type { VehicleDetail } from '../types/transit';
import { useMap } from '../hooks/useMap';

const fetchVehicleDetail = async (vehicleId: string | null, tripId: string): Promise<VehicleDetail> => {
    const url = new URL('/api/vehicle-detail', window.location.origin);
    url.searchParams.set('tripId', tripId);
    if (vehicleId) url.searchParams.set('vehicleId', vehicleId);

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('Failed to fetch vehicle detail');
    return res.json();
};

export const useVehicleDetail = () => {
    const { state } = useMap();
    const { selectedVehicle, selectedId } = state;
    const tripId = selectedVehicle?.gtfs_trip_id;

    return useQuery({
        queryKey: ['vehicle-detail', selectedId, tripId],
        queryFn: () => fetchVehicleDetail(selectedId, tripId!),
        enabled: !!tripId,
        staleTime: 10000,
        refetchInterval: 10000, // 10s - matches vehicle update frequency
        gcTime: 60000,
    });
};
