import { useQuery } from '@tanstack/react-query';
import type { VehicleDetail } from '../../types/transit';
import { useRouteParams } from '../useRouteParams';
import { usePreferencesStore } from '../../state/preferencesStore';
import { LIVE_FETCH_OPTIONS, QUERY_TIMING_MS } from '../../config/constants';
import { apiFetch } from '../../lib/api-client';
import { enrichVehicleDetailRouteMetadata } from '../../lib/enrichment';
import { memoizeLast } from '../../lib/memoize';
import { useRouteMetadata } from './useRouteMetadata';
import { networkVehiclesQueryOptions } from './useVehicles';

const brandVehicleDetail = memoizeLast(enrichVehicleDetailRouteMetadata);

const fetchVehicleDetail = async (city: string, vehicleId: string | null, tripId: string): Promise<VehicleDetail> => {
    const params = new URLSearchParams({ tripId });
    if (vehicleId) params.set('vehicleId', vehicleId);
    return apiFetch<VehicleDetail>(`/${city}/vehicle-detail?${params.toString()}`, LIVE_FETCH_OPTIONS);
};

export const useVehicleDetail = () => {
    const { tripId, vehicleId } = useRouteParams();
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const refreshMs = usePreferencesStore(s => s.refreshIntervalS) * 1000;
    const { byShortName } = useRouteMetadata();
    const { dataUpdatedAt: fleetUpdatedAt } = useQuery({
        ...networkVehiclesQueryOptions(selectedCity, refreshMs),
        enabled: !!selectedCity,
        notifyOnChangeProps: ['dataUpdatedAt'],
    });

    // Keyed by the map's fleet refresh, so the detail is re-read with every map update and never shown from an older one.
    const query = useQuery({
        queryKey: ['vehicle-detail', selectedCity, vehicleId, tripId, fleetUpdatedAt],
        queryFn: () => fetchVehicleDetail(selectedCity, vehicleId, tripId!),
        enabled: !!tripId && !!selectedCity,
        staleTime: refreshMs,
        refetchInterval: refreshMs,
        gcTime: QUERY_TIMING_MS.LIVE_GC,
        // Only the same vehicle's previous detail bridges a refresh; another vehicle's must never show.
        placeholderData: (previous, previousQuery) =>
            previousQuery?.queryKey[2] === vehicleId && previousQuery?.queryKey[3] === tripId ? previous : undefined,
        retry: false,
    });

    const data = query.data ? brandVehicleDetail(query.data, byShortName) : query.data;

    return { ...query, data };
};

