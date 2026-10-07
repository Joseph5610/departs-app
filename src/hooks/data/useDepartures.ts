import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Departure, AppError } from '@/types';
import { useRouteParams } from '@/hooks/useRouteParams';
import { useSelectionStore } from '@/state/selectionStore';
import { usePreferencesStore } from '@/state/preferencesStore';
import { LIVE_FETCH_OPTIONS, DEPARTURES_CONFIG } from '@/config/constants';
import { apiFetch } from '@/lib/apiClient';
import { enrichLiveDepartures, computeDelayStats as computeBoardDelayStats, favoriteKeysAt, favoritesFirst as pinFavoriteLines, sortByExpectedTime, filterDepartures as filterBoardDepartures, groupDepartures as groupBoardDepartures, withDelayDeltas } from '@/domain/departures';
import { memoizeLast } from '@/lib/memoize';
import { useEnrichmentStore } from '@/state/enrichmentStore';
import { useVehicles } from './useVehicles';
import { useRouteMetadata } from './useRouteMetadata';
import { useFleetLookup } from './useVehicleMetadata';
import { queryKeys } from '@/lib/queryKeys';

export interface DeparturesResponse {
    departures: Departure[];
}

/** Departures of one or more stops; `stopId` repeats per stop. */
export const fetchDepartures = (city: string, stopIds: string[], signal?: AbortSignal): Promise<DeparturesResponse> => {
    const params = new URLSearchParams();
    for (const id of stopIds) params.append('stopId', id);
    return apiFetch<DeparturesResponse>(`/${city}/departures?${params.toString()}`, { ...LIVE_FETCH_OPTIONS, signal });
};

/**
 * Fetched departures run through the live pipeline against the current fleet, push patches, route
 * branding and fleet register. `enrich` must be a module-level `memoizeLast` owned by the caller.
 */
export const useLiveDepartures = (departures: Departure[], dataUpdatedAt: number, enrich: typeof enrichLiveDepartures): Departure[] => {
    const byTripId = useEnrichmentStore(s => s.byTripId);
    const byVehicleId = useEnrichmentStore(s => s.byVehicleId);
    const { tripIndex } = useVehicles();
    const { byShortName, byId } = useRouteMetadata();
    const fleet = useFleetLookup();
    return enrich(departures, tripIndex, byTripId, byVehicleId, byShortName, byId, dataUpdatedAt, fleet);
};

const enrichStopDepartures = memoizeLast(enrichLiveDepartures);
const enrichBoardDepartures = memoizeLast(enrichLiveDepartures);
const sortByTime = memoizeLast(sortByExpectedTime);

/** One stop's live departures in time order, for the full-screen board. */
export const useBoardDepartures = (stopId: string) => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const refreshMs = usePreferencesStore(s => s.refreshIntervalS) * 1000;
    const query = useQuery<DeparturesResponse, AppError>({
        queryKey: queryKeys.boardDepartures(selectedCity, stopId),
        queryFn: ({ signal }) => fetchDepartures(selectedCity, [stopId], signal),
        enabled: !!stopId && !!selectedCity,
        refetchInterval: refreshMs,
        staleTime: refreshMs,
        retry: false,
    });
    const live = useLiveDepartures(query.data?.departures ?? NO_DEPARTURES, query.dataUpdatedAt || 0, enrichBoardDepartures);
    return { departures: sortByTime(live), isLoading: query.isLoading, isError: query.isError };
};

const filterDepartures = memoizeLast(filterBoardDepartures);
const groupDepartures = memoizeLast(groupBoardDepartures);
const computeDelayStats = memoizeLast(computeBoardDelayStats);
const favoritesFirst = memoizeLast(pinFavoriteLines);

const NO_FAVORITES: ReadonlySet<string> = new Set();

const NO_DEPARTURES: Departure[] = [];

/**
 * Fetches, enriches, and groups departure data for the selected stop. The derived values are shared
 * between the components that use it (board, header, title) rather than recomputed by each.
 */
export const useDepartures = () => {
    const { stopId } = useRouteParams();
    const selectedLine = useSelectionStore(s => s.selectedLine);
    const requireAirConditioned = usePreferencesStore(s => s.requireAirConditioned);
    const requireWheelchairAccessible = usePreferencesStore(s => s.requireWheelchairAccessible);
    const departureSort = usePreferencesStore(s => s.departureSort);
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const refreshMs = usePreferencesStore(s => s.refreshIntervalS) * 1000;

    const query = useQuery<DeparturesResponse | null, AppError>({
        queryKey: queryKeys.departures(selectedCity, stopId),
        queryFn: async ({ client, queryKey, signal }) => {
            if (!stopId || !selectedCity) {
                return null;
            }
            const data = await fetchDepartures(selectedCity, [stopId], signal);
            if (!data?.departures) return data;
            const previous = client.getQueryState<DeparturesResponse | null>(queryKey);
            const isRecent = !!previous && Date.now() - previous.dataUpdatedAt <= refreshMs * DEPARTURES_CONFIG.DELAY_DELTA_MAX_AGE_REFRESHES;
            return { ...data, departures: withDelayDeltas(data.departures, isRecent ? previous.data?.departures : undefined, previous?.dataUpdatedAt ?? Date.now()) };
        },
        enabled: !!stopId,
        refetchInterval: refreshMs,
        staleTime: refreshMs,
        retry: false,
    });

    const dataUpdatedAt = query.dataUpdatedAt || 0;
    const liveDepartures = useLiveDepartures(query.data?.departures ?? NO_DEPARTURES, dataUpdatedAt, enrichStopDepartures);
    const { filtered, hasAirConditioningData, hasAccessibilityData, hasRequestStop } = filterDepartures(liveDepartures, selectedLine, requireAirConditioned, requireWheelchairAccessible);
    const favoriteLines = usePreferencesStore(s => s.favoriteLines);
    const favoriteKeys = useMemo(() => {
        const keys = favoriteKeysAt(favoriteLines, selectedCity, stopId);
        return keys.length > 0 ? new Set(keys) : NO_FAVORITES;
    }, [favoriteLines, selectedCity, stopId]);
    const groupedDepartures = favoritesFirst(groupDepartures(filtered, departureSort), favoriteKeys);
    const delayStats = computeDelayStats(filtered, dataUpdatedAt);
    const isFiltered = !!selectedLine || (requireAirConditioned && hasAirConditioningData) || (requireWheelchairAccessible && hasAccessibilityData);

    const { data, isLoading, isError, error, refetch } = query;

    return useMemo(() => ({
        data,
        liveDepartures,
        isLoading,
        isError,
        error,
        refetch,
        groupedDepartures,
        delayStats,
        isFiltered,
        selectedLine,
        hasAirConditioningData,
        hasAccessibilityData,
        hasRequestStop,
    }), [data, liveDepartures, isLoading, isError, error, refetch, groupedDepartures, delayStats, isFiltered, selectedLine, hasAirConditioningData, hasAccessibilityData, hasRequestStop]);
};
