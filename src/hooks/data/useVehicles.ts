import { useMemo } from 'react';
import { useQuery, keepPreviousData, queryOptions, type QueryClient, type QueryKey } from '@tanstack/react-query';
import type { VehicleCollection, VehicleFeature } from '../../types/transit';
import { useViewportStore } from '../../state/viewportStore';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useEnrichmentStore } from '../../state/enrichmentStore';
import { enrichVehicleCollection, enrichVehicleRouteMetadata } from '../../lib/enrichment';
import { memoizeLast } from '../../lib/memoize';
import { useRouteMetadata } from './useRouteMetadata';
import { TRANSIT_REFRESH_MS, LIVE_FETCH_OPTIONS, QUERY_TIMING_MS, LIVE_VEHICLES_CONFIG } from '../../config/constants';
import { apiFetch } from '../../lib/api-client';
import { AppErrorCode, type AppError } from '../../types/error';
import { filterVehiclesToView } from '../../lib/vehicle-filter';

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
const networkVehiclesQueryOptions = (selectedCity: string) => queryOptions<VehicleCollection | null, AppError>({
    queryKey: ['vehicles', selectedCity],
    queryFn: ({ client, queryKey }) => fetchNetworkVehicles(selectedCity, client, queryKey),
    refetchInterval: TRANSIT_REFRESH_MS,
    staleTime: QUERY_TIMING_MS.LIVE_STALE,
    gcTime: QUERY_TIMING_MS.LIVE_GC,
    placeholderData: keepPreviousData,
    retry: LIVE_VEHICLES_CONFIG.RETRY_COUNT,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, LIVE_VEHICLES_CONFIG.RETRY_MAX_DELAY_MS),
});

const brandNetworkVehicles = memoizeLast(enrichVehicleRouteMetadata);
const enrichNetworkVehicles = memoizeLast(enrichVehicleCollection);
const selectScreenVehicles = memoizeLast(filterVehiclesToView);

const buildVehicleIndexes = memoizeLast((collection: VehicleCollection | null) => {
    const vehicleIndex = new Map<string, VehicleFeature>();
    const tripIndex = new Map<string, VehicleFeature>();
    for (const f of collection?.features ?? []) {
        if (f.properties.vehicle_id) vehicleIndex.set(f.properties.vehicle_id, f);
        if (f.properties.gtfs_trip_id) tripIndex.set(f.properties.gtfs_trip_id, f);
    }
    return { vehicleIndex, tripIndex };
});

/**
 * useVehicles
 * 
 * The city's live fleet with push patches applied, as `networkVehicles`, and the part of it in the
 * current map view and filters, as `vehicles`. One query serves the map and the stats views.
 */
export const useVehicles = () => {
    const bounds = useViewportStore(s => s.debouncedBounds);
    const routeFilter = useViewportStore(s => s.routeFilter);
    const routeTypeFilter = usePreferencesStore(s => s.routeTypeFilter);
    const selectedCity = usePreferencesStore(s => s.selectedCity);

    const byTripId = useEnrichmentStore(s => s.byTripId);
    const byVehicleId = useEnrichmentStore(s => s.byVehicleId);
    const { byShortName } = useRouteMetadata();

    // Not tied to the map view: the stats views read the same fleet while the map is elsewhere.
    const query = useQuery({
        ...networkVehiclesQueryOptions(selectedCity),
        enabled: !!selectedCity,
    });

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
        isFetching: query.isFetching,
        isError: query.isError,
        error: query.error,
        dataUpdatedAt: query.dataUpdatedAt
    }), [screenVehicles, networkVehicles, vehicleIndex, tripIndex, query.isFetching, query.isError, query.error, query.dataUpdatedAt]);
};
