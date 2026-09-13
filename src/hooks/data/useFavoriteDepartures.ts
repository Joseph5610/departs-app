import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { Departure } from '../../types/transit';
import type { AppError } from '../../types/error';
import type { DeparturesResponse } from './useDepartures';
import { useVehicles } from './useVehicles';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useEnrichmentStore } from '../../state/enrichmentStore';
import { enrichDepartures } from '../../lib/enrichment';
import { apiFetch } from '../../lib/api-client';
import { TRANSIT_REFRESH_MS, LIVE_FETCH_OPTIONS } from '../../config/constants';

/**
 * Live departures for several stops fetched in one request, enriched and grouped by stop ID.
 */
export const useFavoriteDepartures = (stopIds: string[]) => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);

    const query = useQuery<DeparturesResponse | null, AppError>({
        queryKey: ['departures', 'bulk', selectedCity, stopIds.join(',')],
        queryFn: async () => {
            if (stopIds.length === 0 || !selectedCity) return null;
            const params = new URLSearchParams();
            stopIds.forEach(id => params.append('stopId', id));
            return apiFetch<DeparturesResponse>(`/${selectedCity}/departures?${params.toString()}`, LIVE_FETCH_OPTIONS);
        },
        refetchInterval: TRANSIT_REFRESH_MS,
        staleTime: TRANSIT_REFRESH_MS,
        placeholderData: keepPreviousData,
        enabled: stopIds.length > 0
    });

    const byTripId = useEnrichmentStore(s => s.byTripId);
    const byVehicleId = useEnrichmentStore(s => s.byVehicleId);
    const { tripIndex } = useVehicles();

    const departuresByStop = useMemo(() => {
        const byStop = new Map<string, Departure[]>();
        if (!query.data?.departures) return byStop;

        const enriched = enrichDepartures(query.data.departures, tripIndex, byTripId, byVehicleId, query.dataUpdatedAt || 0);
        for (const dep of enriched) {
            if (!dep.stopId) continue;
            const list = byStop.get(dep.stopId);
            if (list) list.push(dep);
            else byStop.set(dep.stopId, [dep]);
        }
        return byStop;
    }, [query.data, query.dataUpdatedAt, tripIndex, byTripId, byVehicleId]);

    return { departuresByStop, isLoading: query.isLoading, isError: query.isError };
};
