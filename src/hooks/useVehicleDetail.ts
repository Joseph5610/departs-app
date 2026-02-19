import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { VehicleDetail } from '../types/transit';
import { useMap } from '../hooks/useMap';

const fetchVehicleDetail = async (vehicleId: string, tripId: string): Promise<VehicleDetail> => {
    const res = await fetch(`/api/vehicle-detail?vehicleId=${vehicleId}&tripId=${tripId}`);
    if (!res.ok) throw new Error('Failed to fetch vehicle detail');
    return res.json();
};

export const useVehicleDetail = () => {
    const { state } = useMap();
    const { selectedVehicle, selectedId } = state;

    const trackedId = useMemo(() => {
        if (!selectedVehicle) return null;
        return selectedVehicle.gtfs_trip_id || selectedVehicle.trip_id || null;
    }, [selectedVehicle]);

    const vehicleIdStr = selectedId ? String(selectedId) : null;
    const tripIdStr = trackedId ? String(trackedId) : null;

    return useQuery({
        queryKey: ['vehicle-detail', vehicleIdStr, tripIdStr],
        queryFn: () => fetchVehicleDetail(vehicleIdStr!, tripIdStr!),
        enabled: !!vehicleIdStr && !!tripIdStr,
        staleTime: 10000,
        refetchInterval: 10000, // 10s - matches vehicle update frequency
        gcTime: 60000,
    });
};
