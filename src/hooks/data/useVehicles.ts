import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { VehicleCollection } from '../../types/transit';
import { useViewport, usePreferences } from '../../state/MapStateProvider';
import { TRANSIT_REFRESH_MS } from '../../config/constants';

const fetchVehicles = async (bounds: string | null, routeFilter: string[] | null, routeTypeFilter: string[]): Promise<VehicleCollection | null> => {
    try {
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

        const response = await fetch(url.toString());
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        return await response.json();
    } catch {
        return null;
    }
};

/**
 * useVehicles
 * 
 * Subscribes to the live vehicle API and handles high-frequency location updates.
 * Synchronizes backend details (low-frequency) with live map stream (high-frequency).
 * Disables polling automatically while the map is dragged or the user is tracking.
 */
export const useVehicles = () => {
    const { state: vpState } = useViewport();
    const { state: prefState } = usePreferences();
    const { debouncedBounds: bounds, routeFilter } = vpState;
    const { routeTypeFilter } = prefState;

    const query = useQuery<VehicleCollection | null, Error>({
        queryKey: ['vehicles', bounds, routeFilter, routeTypeFilter],
        queryFn: () => fetchVehicles(bounds, routeFilter, routeTypeFilter),
        enabled: !!bounds || (!!routeFilter && routeFilter.length > 0) || routeTypeFilter.length > 0,
        refetchInterval: TRANSIT_REFRESH_MS,
        staleTime: 5000,
        gcTime: 60000,
        placeholderData: keepPreviousData,
    });

    return useMemo(() => ({
        vehicles: query.data,
        isFetching: query.isFetching,
        dataUpdatedAt: query.dataUpdatedAt
    }), [query.data, query.isFetching, query.dataUpdatedAt]);
};
