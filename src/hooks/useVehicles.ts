import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { VehicleCollection, VehicleFeature } from '../types/transit';
import { useMap } from '../hooks/useMap';

const fetchRawVehicles = async (bounds: string | null, trackedId: string | null, routeFilter: string[] | null): Promise<VehicleFeature[]> => {
    try {
        const url = new URL('/api/vehicles', window.location.origin);

        if (bounds) url.searchParams.set('bounds', bounds);
        if (trackedId) url.searchParams.set('tripId', trackedId);
        if (routeFilter && routeFilter.length > 0) {
            routeFilter.forEach(line => url.searchParams.append('routeShortName', line));
        }

        if (url.searchParams.toString() === '') return [];

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
    const { debouncedBounds: bounds, selectedVehicle, routeFilter } = state;

    const trackedId = useMemo(() => {
        if (!selectedVehicle) return null;
        return selectedVehicle.gtfs_trip_id || selectedVehicle.trip_id || null;
    }, [selectedVehicle]);

    const selectFn = useCallback((allFeatures: VehicleFeature[]): VehicleCollection => {
        return {
            type: 'FeatureCollection',
            features: allFeatures
        };
    }, []);

    const query = useQuery<VehicleFeature[], Error, VehicleCollection>({
        queryKey: ['vehicles', bounds, trackedId, routeFilter],
        queryFn: () => fetchRawVehicles(bounds, trackedId, routeFilter),
        select: selectFn,
        enabled: !!bounds || !!trackedId || (!!routeFilter && routeFilter.length > 0),
        refetchInterval: 10000,
        staleTime: 5000,
        gcTime: 60000,
        placeholderData: keepPreviousData,
        refetchOnMount: false,
        refetchOnReconnect: false,
    });

    return {
        vehicles: query.data,
        isFetching: query.isFetching,
        dataUpdatedAt: query.dataUpdatedAt
    };
};
