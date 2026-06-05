import { useQuery } from '@tanstack/react-query';
import type { VehicleDetail } from '../../types/transit';
import { useRouteParams } from '../useRouteParams';
import { usePreferencesStore } from '../../state/preferencesStore';
import { TRANSIT_REFRESH_MS } from '../../config/constants';
import { apiFetch } from '../../lib/api-client';

const fetchVehicleDetail = async (city: string, vehicleId: string | null, tripId: string): Promise<VehicleDetail> => {
    const url = new URL(`/${city}/vehicle-detail`, window.location.origin);
    url.searchParams.set('tripId', tripId);
    if (vehicleId) {
        url.searchParams.set('vehicleId', vehicleId);
    }
    return apiFetch<VehicleDetail>(url.toString());
};

export const useVehicleDetail = () => {
    const { tripId, vehicleId } = useRouteParams();
    const selectedCity = usePreferencesStore(s => s.selectedCity);

    return useQuery({
        queryKey: ['vehicle-detail', selectedCity, vehicleId, tripId],
        queryFn: () => { return fetchVehicleDetail(selectedCity, vehicleId, tripId!); },
        enabled: !!tripId && !!selectedCity,
        staleTime: TRANSIT_REFRESH_MS,
        refetchInterval: TRANSIT_REFRESH_MS, // matches vehicle update frequency
        gcTime: 60000,
    });
};

