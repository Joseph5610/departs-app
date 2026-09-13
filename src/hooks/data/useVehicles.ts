import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { VehicleCollection, VehicleFeature } from '../../types/transit';
import { useViewportStore } from '../../state/viewportStore';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useEnrichmentStore } from '../../state/enrichmentStore';
import { enrichVehicleCollection } from '../../lib/enrichment';
import { memoizeLast } from '../../lib/memoize';
import { TRANSIT_REFRESH_MS, LIVE_FETCH_OPTIONS, QUERY_TIMING_MS } from '../../config/constants';
import { apiFetch } from '../../lib/api-client';
import type { AppError } from '../../types/error';

const fetchVehicles = async (selectedCity: string, bounds: string | null, routeFilter: string[] | null, routeTypeFilter: string[]): Promise<VehicleCollection | null> => {
    const params = new URLSearchParams();

    if (bounds) {
        params.set('bounds', bounds);
    }
    if (routeFilter && routeFilter.length > 0) {
        routeFilter.forEach((line) => {
            params.append('routeShortName', line);
        });
    }
    if (routeTypeFilter.length > 0) {
        routeTypeFilter.forEach((type) => {
            params.append('routeType', type);
        });
    }

    const queryStr = params.toString();
    return apiFetch<VehicleCollection>(`/${selectedCity}/vehicles${queryStr ? `?${queryStr}` : ''}`, LIVE_FETCH_OPTIONS);
};

const enrichScreenVehicles = memoizeLast(enrichVehicleCollection);

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
 * Subscribes to the live vehicle API and handles high-frequency location updates.
 * Synchronizes backend details (low-frequency) with live map stream (high-frequency).
 * Disables polling automatically while the map is dragged or the user is tracking.
 */
export const useVehicles = () => {
    const bounds = useViewportStore(s => s.debouncedBounds);
    const routeFilter = useViewportStore(s => s.routeFilter);
    const routeTypeFilter = usePreferencesStore(s => s.routeTypeFilter);
    const selectedCity = usePreferencesStore(s => s.selectedCity);

    const byTripId = useEnrichmentStore(s => s.byTripId);
    const byVehicleId = useEnrichmentStore(s => s.byVehicleId);

    const query = useQuery<VehicleCollection | null, AppError>({
        queryKey: ['vehicles', selectedCity, bounds, routeFilter, routeTypeFilter],
        queryFn: () => fetchVehicles(selectedCity, bounds, routeFilter, routeTypeFilter),
        enabled: !!selectedCity && !!bounds,
        refetchInterval: (query) => (bounds && query.state.dataUpdatedAt ? TRANSIT_REFRESH_MS : false),
        staleTime: QUERY_TIMING_MS.LIVE_STALE,
        gcTime: QUERY_TIMING_MS.LIVE_GC,
        placeholderData: keepPreviousData,
        retry: 1,
    });

    const enrichedCollection = enrichScreenVehicles(query.data, byTripId, byVehicleId, query.dataUpdatedAt || 0);
    const { vehicleIndex, tripIndex } = buildVehicleIndexes(enrichedCollection);

    return useMemo(() => ({
        vehicles: enrichedCollection,
        vehicleIndex,
        tripIndex,
        isFetching: query.isFetching,
        isError: query.isError,
        error: query.error,
        dataUpdatedAt: query.dataUpdatedAt
    }), [enrichedCollection, vehicleIndex, tripIndex, query.isFetching, query.isError, query.error, query.dataUpdatedAt]);
};
