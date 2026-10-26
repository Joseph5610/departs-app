import { useMemo } from 'react';
import { useQuery, keepPreviousData, queryOptions, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { type VehicleCollection, AppErrorCode, type AppError } from '@/types';
import { useViewportStore } from '@/state/viewportStore';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useEnrichmentStore } from '@/state/enrichmentStore';
import { enrichVehicleCollection } from '@/domain/realtime';
import { enrichVehicleRouteMetadata, indexVehicles, filterVehiclesToView, estimateFleetDelays, withEstimatedPatches, indexStopTimeSlice } from '@/domain/vehicles';
import { memoizeLast } from '@/lib/memoize';
import { useRouteMetadata } from './useRouteMetadata';
import { useCityConfig } from './useCities';
import { useStopTimeSlice } from './useStopTimeSlice';
import { LIVE_FETCH_OPTIONS, QUERY_TIMING_MS, LIVE_VEHICLES_CONFIG } from '@/config/constants';
import { apiFetch } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';

/**
 * The city's whole fleet. An `upstream_offline` answer is thrown while recent positions are held, so it
 * is retried and one failed backend refresh does not blank the map; past MAX_KEPT_AGE_MS it is shown.
 */
const fetchNetworkVehicles = async (selectedCity: string, client: QueryClient, queryKey: QueryKey): Promise<VehicleCollection | null> => {
    const collection = await apiFetch<VehicleCollection>(`/${selectedCity}/vehicles`, LIVE_FETCH_OPTIONS);
    if (collection?.status !== 'upstream_offline') return collection;

    const previous = client.getQueryData<VehicleCollection | null>(queryKey);
    const previousMs = previous?.last_updated ? Date.parse(previous.last_updated) : NaN;
    const isHoldingRecent = !!previous?.features.length && Date.now() - previousMs < LIVE_VEHICLES_CONFIG.MAX_KEPT_AGE_MS;
    if (!isHoldingRecent) return collection;

    const error = new Error('Vehicle source offline') as AppError;
    error.code = AppErrorCode.UPSTREAM_ERROR;
    error.isUpstream = true;
    throw error;
};

/**
 * One city-wide query shared by the map and the stats views. It carries no viewport or filter
 * parameters, so every client of a city requests the same URL and the edge cache answers most polls.
 */
export const networkVehiclesQueryOptions = (selectedCity: string, refreshMs: number) => queryOptions<VehicleCollection | null, AppError>({
    queryKey: queryKeys.vehicles(selectedCity),
    queryFn: ({ client, queryKey }) => fetchNetworkVehicles(selectedCity, client, queryKey),
    refetchInterval: refreshMs,
    staleTime: QUERY_TIMING_MS.LIVE_STALE,
    gcTime: QUERY_TIMING_MS.LIVE_GC,
    placeholderData: keepPreviousData,
    // The next poll is the retry: an immediate one only doubles the load on a struggling backend.
    retry: false,
});

/**
 * The same fleet query for a consumer that only reads it (a trip's detail, the push patches): it never polls, as
 * `refetchInterval` runs per subscriber and timers out of step would fetch the fleet once each. The map polls it.
 */
export const networkVehiclesReaderOptions = (selectedCity: string) => queryOptions<VehicleCollection | null, AppError>({
    ...networkVehiclesQueryOptions(selectedCity, 0),
    refetchInterval: false,
    refetchOnMount: false,
});

const brandNetworkVehicles = memoizeLast(enrichVehicleRouteMetadata);
const indexSlice = memoizeLast(indexStopTimeSlice);
const estimateDelays = memoizeLast(estimateFleetDelays);
const addEstimatedPatches = memoizeLast(withEstimatedPatches);
const enrichNetworkVehicles = memoizeLast(enrichVehicleCollection);
const selectScreenVehicles = memoizeLast(filterVehiclesToView);
const buildVehicleIndexes = memoizeLast(indexVehicles);


/** The push channel's patches with the app's own estimate for `fleet` added, in cities with `estimatesDelay`. */
const usePatchesFor = (fleet: VehicleCollection | null | undefined, fleetUpdatedAt: number) => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { timezone, estimatesDelay } = useCityConfig();
    const pushByTripId = useEnrichmentStore(s => s.byTripId);
    const byVehicleId = useEnrichmentStore(s => s.byVehicleId);

    const slice = useStopTimeSlice(selectedCity, timezone, !!estimatesDelay, fleetUpdatedAt);
    // Estimated once per fleet poll; each push flush only merges them.
    const estimates = estimateDelays(fleet, indexSlice(slice), timezone, fleetUpdatedAt);
    const byTripId = addEstimatedPatches(estimates, pushByTripId, byVehicleId);

    return useMemo(() => ({ byTripId, byVehicleId }), [byTripId, byVehicleId]);
};

/**
 * The enrichment every live consumer applies, for a consumer that does not need the fleet itself: push
 * channel patches, plus the app's own delay estimate. `enabled: false` keeps it off the fleet poll.
 */
export const useEnrichmentPatches = (enabled = true) => {
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { data, dataUpdatedAt } = useQuery({
        ...networkVehiclesReaderOptions(selectedCity),
        enabled: enabled && !!selectedCity,
    });
    return usePatchesFor(data, dataUpdatedAt);
};

/**
 * The city's live fleet with push patches applied, as `networkVehicles`, and the part of it in the
 * current map view and filters, as `vehicles`, with the patches themselves for the fleet's other consumers.
 * One query serves the map and the stats views.
 */
export const useVehicles = () => {
    const bounds = useViewportStore(s => s.debouncedBounds);
    const routeFilter = useViewportStore(s => s.routeFilter);
    const routeTypeFilter = usePreferencesStore(s => s.routeTypeFilter);
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const refreshMs = usePreferencesStore(s => s.refreshIntervalS) * 1000;

    const { byShortName } = useRouteMetadata();

    // Not tied to the map view: the stats views read the same fleet while the map is elsewhere.
    const query = useQuery({
        ...networkVehiclesQueryOptions(selectedCity, refreshMs),
        enabled: !!selectedCity,
    });
    const { byTripId, byVehicleId } = usePatchesFor(query.data, query.dataUpdatedAt);

    const brandedVehicles = brandNetworkVehicles(query.data, byShortName);
    const networkVehicles = enrichNetworkVehicles(brandedVehicles, byTripId, byVehicleId, query.dataUpdatedAt || 0);
    const screenVehicles = selectScreenVehicles(networkVehicles, bounds, routeFilter, routeTypeFilter);
    // Whole fleet, so off-screen vehicles resolve for the selection, departure boards and connections.
    const { vehicleIndex, tripIndex } = buildVehicleIndexes(networkVehicles);

    return useMemo(() => ({
        vehicles: screenVehicles,
        networkVehicles,
        vehicleIndex,
        tripIndex,
        byTripId,
        byVehicleId,
        isFetching: query.isFetching,
        isError: query.isError,
        error: query.error,
        dataUpdatedAt: query.dataUpdatedAt
    }), [screenVehicles, networkVehicles, vehicleIndex, tripIndex, byTripId, byVehicleId, query.isFetching, query.isError, query.error, query.dataUpdatedAt]);
};
