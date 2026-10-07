import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { VehicleDetail } from '@/types';
import { useRouteParams } from '@/hooks/useRouteParams';
import { usePreferencesStore } from '@/state/preferencesStore';
import { LIVE_FETCH_OPTIONS, QUERY_TIMING_MS } from '@/config/constants';
import { apiFetch } from '@/lib/apiClient';
import { enrichVehicleDetailRouteMetadata } from '@/domain/vehicles';
import { useRouteMetadata } from './useRouteMetadata';
import { networkVehiclesQueryOptions } from './useVehicles';
import { queryKeys } from '@/lib/queryKeys';

const fetchVehicleDetail = async (city: string, vehicleId: string | null, tripId: string): Promise<VehicleDetail> => {
    const params = new URLSearchParams({ tripId });
    if (vehicleId) params.set('vehicleId', vehicleId);
    return apiFetch<VehicleDetail>(`/${city}/vehicle-detail?${params.toString()}`, LIVE_FETCH_OPTIONS);
};

/** A trip's detail, re-read with every fleet refresh of its city; also used for a ride while another page is open. */
export const useTripDetail = (city: string, tripId: string | null, vehicleId: string | null) => {
    const refreshMs = usePreferencesStore(s => s.refreshIntervalS) * 1000;
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { byShortName } = useRouteMetadata();
    const { dataUpdatedAt: fleetUpdatedAt } = useQuery({
        ...networkVehiclesQueryOptions(city, refreshMs),
        enabled: !!city,
        notifyOnChangeProps: ['dataUpdatedAt'],
    });

    // Keyed by the map's fleet refresh, so the detail is re-read with every map update and never shown from an older one.
    const query = useQuery({
        queryKey: queryKeys.vehicleDetail(city, vehicleId, tripId, fleetUpdatedAt),
        queryFn: () => fetchVehicleDetail(city, vehicleId, tripId!),
        enabled: !!tripId && !!city,
        staleTime: refreshMs,
        refetchInterval: refreshMs,
        gcTime: QUERY_TIMING_MS.LIVE_GC,
        // Only the same trip's previous detail bridges a refresh, including the moment a planned trip gains its vehicle.
        placeholderData: (previous, previousQuery) =>
            previousQuery?.queryKey[3] === tripId && (previousQuery?.queryKey[2] === vehicleId || previousQuery?.queryKey[2] === null) ? previous : undefined,
        retry: false,
    });

    // The routes join is the selected city's, so another city's trip keeps the backend's colours.
    const brandWith = city === selectedCity ? byShortName : null;
    const data = useMemo(
        () => (query.data && brandWith ? enrichVehicleDetailRouteMetadata(query.data, brandWith) : query.data),
        [query.data, brandWith]
    );

    return { ...query, data };
};

/** The detail of the trip in the URL. */
export const useVehicleDetail = () => {
    const { tripId, vehicleId } = useRouteParams();
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    return useTripDetail(selectedCity, tripId, vehicleId);
};
