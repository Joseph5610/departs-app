import { useEffect, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { Departure, AppError } from '@/types';
import { fetchDepartures, useLiveDepartures, type DeparturesResponse } from './useDepartures';
import { usePreferencesStore } from '@/state/preferencesStore';
import { departuresByStop, enrichLiveDepartures } from '@/domain/departures';
import { memoizeLast } from '@/lib/memoize';
import { queryKeys } from '@/lib/queryKeys';
import { selectStop } from '@/domain/stops';
import type { StopModel } from '@/types';
import { useStops } from './useStops';
import { DEPARTURES_CONFIG } from '@/config/constants';

const enrichFavoriteDepartures = memoizeLast(enrichLiveDepartures);
const splitByStop = memoizeLast(departuresByStop);

/** Each stop's departures request id, for the stops whose one can be told yet. */
const requestsOf = memoizeLast((stopIds: string[], model: StopModel | null): Map<string, string> => {
    const requests = new Map<string, string>();
    for (const id of stopIds) {
        const request = selectStop(id, model).departuresId;
        if (request) requests.set(id, request);
    }
    return requests;
});

const NO_DEPARTURES: Departure[] = [];

/**
 * Live departures for several stops fetched in one request, enriched and grouped by the stop ids given.
 * While `isIdle` (nothing shows them) they refresh only every PEEK_REFRESH_MS, and at once when shown again if stale.
 */
export const useFavoriteDepartures = (stopIds: string[], isIdle = false) => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const refreshMs = usePreferencesStore(s => s.refreshIntervalS) * 1000;
    const { model } = useStops();
    const requests = requestsOf(stopIds, model);
    const requestIds = useMemo(() => [...new Set(requests.values())].sort(), [requests]);

    const query = useQuery<DeparturesResponse | null, AppError>({
        queryKey: queryKeys.favoriteDepartures(selectedCity, requestIds),
        queryFn: async ({ signal }) => {
            if (requestIds.length === 0 || !selectedCity) return null;
            return fetchDepartures(selectedCity, requestIds, signal, DEPARTURES_CONFIG.FAVORITES_PER_LINE);
        },
        refetchInterval: isIdle ? DEPARTURES_CONFIG.PEEK_REFRESH_MS : refreshMs,
        staleTime: refreshMs,
        placeholderData: keepPreviousData,
        retry: false,
        enabled: requestIds.length > 0
    });

    const { refetch, dataUpdatedAt } = query;
    useEffect(() => {
        if (!isIdle && dataUpdatedAt > 0 && Date.now() - dataUpdatedAt >= refreshMs) void refetch({ cancelRefetch: false });
    }, [isIdle, dataUpdatedAt, refreshMs, refetch]);

    const live = useLiveDepartures(query.data?.departures ?? NO_DEPARTURES, query.dataUpdatedAt || 0, enrichFavoriteDepartures);

    return { departuresByStop: splitByStop(live, requests), isLoading: query.isLoading, isError: query.isError };
};
