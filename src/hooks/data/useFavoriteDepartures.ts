import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { Departure, AppError } from '@/types';
import { fetchDepartures, useLiveDepartures, type DeparturesResponse } from './useDepartures';
import { usePreferencesStore } from '@/state/preferencesStore';
import { departuresByStop, enrichLiveDepartures } from '@/domain/departures';
import { memoizeLast } from '@/lib/memoize';
import { queryKeys } from '@/lib/queryKeys';

const enrichFavoriteDepartures = memoizeLast(enrichLiveDepartures);

const NO_DEPARTURES: Departure[] = [];

/**
 * Live departures for several stops fetched in one request, enriched and grouped by stop ID.
 */
export const useFavoriteDepartures = (stopIds: string[]) => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const refreshMs = usePreferencesStore(s => s.refreshIntervalS) * 1000;

    const query = useQuery<DeparturesResponse | null, AppError>({
        queryKey: queryKeys.favoriteDepartures(selectedCity, stopIds),
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

    const byStop = useMemo(() => departuresByStop(live), [live]);

    return { departuresByStop: byStop, isLoading: query.isLoading, isError: query.isError };
};
