import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { VehicleCollection } from '../../types/transit';
import { useViewportStore } from '../../state/viewportStore';
import { usePreferencesStore } from '../../state/preferencesStore';
import { TRANSIT_REFRESH_MS } from '../../config/constants';
import { apiFetch } from '../../lib/api-client';
import type { AppError } from '../../types/error';

const fetchVehicles = async (bounds: string | null, routeFilter: string[] | null, routeTypeFilter: string[]): Promise<VehicleCollection | null> => {
    const url = new URL('/api/vehicles', window.location.origin);

    if (bounds) {
        url.searchParams.set('bounds', bounds);
    }
    if (routeFilter && routeFilter.length > 0) {
        routeFilter.forEach((line) => {
            url.searchParams.append('routeShortName', line);
        });
    }
    if (routeTypeFilter.length > 0) {
        routeTypeFilter.forEach((type) => {
            url.searchParams.append('routeType', type);
        });
    }

    if (url.searchParams.toString() === '') {
        return null;
    }

    return apiFetch<VehicleCollection>(url);
};

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

    const query = useQuery<VehicleCollection | null, AppError>({
        queryKey: ['vehicles', bounds, routeFilter, routeTypeFilter],
        queryFn: () => fetchVehicles(bounds, routeFilter, routeTypeFilter),
        enabled: !!bounds || (!!routeFilter && routeFilter.length > 0) || routeTypeFilter.length > 0,
        refetchInterval: TRANSIT_REFRESH_MS,
        staleTime: 5000,
        gcTime: 60000,
        placeholderData: keepPreviousData,
        retry: 1,
    });

    return useMemo(() => ({
        vehicles: query.data,
        isFetching: query.isFetching,
        isError: query.isError,
        error: query.error,
        dataUpdatedAt: query.dataUpdatedAt
    }), [query.data, query.isFetching, query.isError, query.error, query.dataUpdatedAt]);
};
