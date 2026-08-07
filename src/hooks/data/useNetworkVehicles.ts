import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { VehicleCollection } from '../../types/transit';
import { usePreferencesStore } from '../../state/preferencesStore';
import { TRANSIT_REFRESH_MS } from '../../config/constants';
import { apiFetch } from '../../lib/api-client';
import type { AppError } from '../../types/error';

const fetchNetworkVehicles = async (selectedCity: string): Promise<VehicleCollection | null> => {
    const url = new URL(`/${selectedCity}/vehicles`, window.location.origin);
    return apiFetch<VehicleCollection>(url);
};

/**
 * useNetworkVehicles
 * 
 * Fetches all vehicles active in the entire network (city wide), without map bounds.
 */
export const useNetworkVehicles = () => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);

    const query = useQuery<VehicleCollection | null, AppError>({
        queryKey: ['networkVehicles', selectedCity],
        queryFn: () => fetchNetworkVehicles(selectedCity),
        enabled: !!selectedCity,
        refetchInterval: TRANSIT_REFRESH_MS,
        staleTime: 5000,
        gcTime: 60000,
        placeholderData: keepPreviousData,
        retry: 1,
    });

    return query;
};
