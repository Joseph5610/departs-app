import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { VehicleCollection, VehicleFeature } from '../types/transit';
import { useMap } from '../hooks/useMap';

const fetchRawVehicles = async (bounds: string | null, routeFilter: string[] | null, routeTypeFilter: string[]): Promise<VehicleFeature[]> => {
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
            return [];
        }

        const response = await fetch(url.toString());
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const json = await response.json();
        return json.features || [];
    } catch {
        return [];
    }
};

export const useVehicles = () => {
    const { state } = useMap();
    const { debouncedBounds: bounds, routeFilter, routeTypeFilter } = state;

    const selectFn = useCallback((allFeatures: VehicleFeature[]): VehicleCollection => {
        return {
            type: 'FeatureCollection',
            features: allFeatures
        };
    }, []);

    const query = useQuery<VehicleFeature[], Error, VehicleCollection>({
        queryKey: ['vehicles', bounds, routeFilter, routeTypeFilter],
        queryFn: () => fetchRawVehicles(bounds, routeFilter, routeTypeFilter),
        select: selectFn,
        enabled: !!bounds || (!!routeFilter && routeFilter.length > 0) || routeTypeFilter.length > 0,
        refetchInterval: 10000,
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
