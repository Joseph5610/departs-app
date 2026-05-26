import { useQuery } from '@tanstack/react-query';
import type { VehicleDetail } from '../../types/transit';
import { useSelectionStore } from '../../state/selectionStore';
import { TRANSIT_REFRESH_MS } from '../../config/constants';

import { apiFetch } from '../../lib/api-client';

const fetchVehicleDetail = async (vehicleId: string | null, tripId: string): Promise<VehicleDetail> => {
    const url = new URL('/api/vehicle-detail', window.location.origin);
    url.searchParams.set('tripId', tripId);
    if (vehicleId) {
        url.searchParams.set('vehicleId', vehicleId);
    }
    return apiFetch<VehicleDetail>(url.toString());
};

export const useVehicleDetail = () => {
    const tripId = useSelectionStore(s => s.selectedTripId);
    const vehicleId = useSelectionStore(s => s.selectedVehicleId);

    return useQuery({
        queryKey: ['vehicle-detail', vehicleId, tripId],
        queryFn: () => { return fetchVehicleDetail(vehicleId, tripId!); },
        enabled: !!tripId,
        staleTime: TRANSIT_REFRESH_MS,
        refetchInterval: TRANSIT_REFRESH_MS, // matches vehicle update frequency
        gcTime: 60000,
    });
};
