import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { VehicleCollection } from '../../types/transit';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useEnrichmentStore } from '../../state/enrichmentStore';
import { enrichVehicleCollection } from '../../lib/enrichment';
import { memoizeLast } from '../../lib/memoize';
import { TRANSIT_REFRESH_MS, LIVE_FETCH_OPTIONS, QUERY_TIMING_MS } from '../../config/constants';
import { apiFetch } from '../../lib/api-client';
import type { AppError } from '../../types/error';

const fetchNetworkVehicles = (selectedCity: string): Promise<VehicleCollection | null> =>
    apiFetch<VehicleCollection>(`/${selectedCity}/vehicles`, LIVE_FETCH_OPTIONS);

const enrichNetworkVehicles = memoizeLast(enrichVehicleCollection);

/**
 * useNetworkVehicles
 * 
 * Fetches all vehicles active in the entire network (city wide), without map bounds, with push patches applied.
 */
export const useNetworkVehicles = (enabled = true) => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);

    const query = useQuery<VehicleCollection | null, AppError>({
        queryKey: ['networkVehicles', selectedCity],
        queryFn: () => fetchNetworkVehicles(selectedCity),
        enabled: enabled && !!selectedCity,
        refetchInterval: TRANSIT_REFRESH_MS,
        staleTime: QUERY_TIMING_MS.LIVE_STALE,
        gcTime: QUERY_TIMING_MS.LIVE_GC,
        placeholderData: keepPreviousData,
        retry: 1,
    });

    const byTripId = useEnrichmentStore(s => s.byTripId);
    const byVehicleId = useEnrichmentStore(s => s.byVehicleId);

    const data = enrichNetworkVehicles(query.data, byTripId, byVehicleId, query.dataUpdatedAt || 0);
    const isFetching = query.isFetching;

    return useMemo(() => ({ data, isFetching }), [data, isFetching]);
};
