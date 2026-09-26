import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { Departure } from '../../types/transit';
import type { AppError } from '../../types/error';
import type { DeparturesResponse } from './useDepartures';
import { useVehicles } from './useVehicles';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useEnrichmentStore } from '../../state/enrichmentStore';
import { enrichLiveDepartures } from '../../lib/enrichment';
import { apiFetch } from '../../lib/api-client';
import { LIVE_FETCH_OPTIONS } from '../../config/constants';
import { useRouteMetadata } from './useRouteMetadata';

/**
 * Live departures for several stops fetched in one request, enriched and grouped by stop ID.
 */
export const useFavoriteDepartures = (stopIds: string[]) => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const refreshMs = usePreferencesStore(s => s.refreshIntervalS) * 1000;

    const query = useQuery<DeparturesResponse | null, AppError>({
        queryKey: ['departures', 'bulk', selectedCity, stopIds.join(',')],
        queryFn: async () => {
            if (stopIds.length === 0 || !selectedCity) return null;
            const params = new URLSearchParams();
            stopIds.forEach(id => params.append('stopId', id));
            return apiFetch<DeparturesResponse>(`/${selectedCity}/departures?${params.toString()}`, LIVE_FETCH_OPTIONS);
        },
        refetchInterval: refreshMs,
        staleTime: refreshMs,
        placeholderData: keepPreviousData,
        enabled: stopIds.length > 0
    });

    const byTripId = useEnrichmentStore(s => s.byTripId);
    const byVehicleId = useEnrichmentStore(s => s.byVehicleId);
    const { tripIndex } = useVehicles();
    const { byShortName, byId } = useRouteMetadata();

    const departuresByStop = useMemo(() => {
        const byStop = new Map<string, Departure[]>();
        if (!query.data?.departures) return byStop;

        const live = enrichLiveDepartures(query.data.departures, tripIndex, byTripId, byVehicleId, byShortName, byId, query.dataUpdatedAt || 0);
        for (const dep of live) {
            if (!dep.stopId) continue;
            const list = byStop.get(dep.stopId);
            if (list) list.push(dep);
            else byStop.set(dep.stopId, [dep]);
        }
        return byStop;
    }, [query.data, query.dataUpdatedAt, tripIndex, byTripId, byVehicleId, byShortName, byId]);

    return { departuresByStop, isLoading: query.isLoading, isError: query.isError };
};
