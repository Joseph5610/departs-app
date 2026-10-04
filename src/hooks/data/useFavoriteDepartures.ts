import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { Departure } from '../../types/transit';
import type { AppError } from '../../types/error';
import { fetchDepartures, useLiveDepartures, type DeparturesResponse } from './useDepartures';
import { usePreferencesStore } from '../../state/preferencesStore';
import { enrichLiveDepartures } from '../../lib/enrichment';
import { memoizeLast } from '../../lib/memoize';

const enrichFavoriteDepartures = memoizeLast(enrichLiveDepartures);

const NO_DEPARTURES: Departure[] = [];

/**
 * Live departures for several stops fetched in one request, enriched and grouped by stop ID.
 */
export const useFavoriteDepartures = (stopIds: string[]) => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const refreshMs = usePreferencesStore(s => s.refreshIntervalS) * 1000;

    const query = useQuery<DeparturesResponse | null, AppError>({
        queryKey: ['departures', 'bulk', selectedCity, stopIds.join(',')],
        queryFn: async ({ signal }) => {
            if (stopIds.length === 0 || !selectedCity) return null;
            return fetchDepartures(selectedCity, stopIds, signal);
        },
        refetchInterval: refreshMs,
        staleTime: refreshMs,
        placeholderData: keepPreviousData,
        retry: false,
        enabled: stopIds.length > 0
    });

    const live = useLiveDepartures(query.data?.departures ?? NO_DEPARTURES, query.dataUpdatedAt || 0, enrichFavoriteDepartures);

    const departuresByStop = useMemo(() => {
        const byStop = new Map<string, Departure[]>();
        for (const dep of live) {
            if (!dep.stopId) continue;
            const list = byStop.get(dep.stopId);
            if (list) list.push(dep);
            else byStop.set(dep.stopId, [dep]);
        }
        return byStop;
    }, [live]);

    return { departuresByStop, isLoading: query.isLoading, isError: query.isError };
};
