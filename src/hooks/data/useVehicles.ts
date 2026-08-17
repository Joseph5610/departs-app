import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { VehicleCollection, VehicleFeature } from '../../types/transit';
import { useViewportStore } from '../../state/viewportStore';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useEnrichmentStore } from '../../state/enrichmentStore';
import { applyEnrichment } from '../../lib/enrichment';
import { TRANSIT_REFRESH_MS } from '../../config/constants';
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
    return apiFetch<VehicleCollection>(`/${selectedCity}/vehicles${queryStr ? `?${queryStr}` : ''}`);
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
    const selectedCity = usePreferencesStore(s => s.selectedCity);

    const byTripId = useEnrichmentStore(s => s.byTripId);
    const byVehicleId = useEnrichmentStore(s => s.byVehicleId);

    const query = useQuery<VehicleCollection | null, AppError>({
        queryKey: ['vehicles', selectedCity, bounds, routeFilter, routeTypeFilter],
        queryFn: () => fetchVehicles(selectedCity, bounds, routeFilter, routeTypeFilter),
        enabled: !!selectedCity && !!bounds,
        refetchInterval: (query) => (bounds && query.state.dataUpdatedAt ? TRANSIT_REFRESH_MS : false),
        staleTime: 5000,
        gcTime: 60000,
        placeholderData: keepPreviousData,
        retry: 1,
    });

    const enrichedCollection = useMemo((): VehicleCollection | null => {
        if (!query.data) return null;
        if (!query.data.features || query.data.features.length === 0) return query.data;

        const baseTs = query.dataUpdatedAt || 0;
        const features = query.data.features.map((f): VehicleFeature => {
            const enrichedProps = applyEnrichment(
                f.properties,
                f.properties.gtfs_trip_id,
                f.properties.vehicle_id,
                byTripId,
                byVehicleId,
                baseTs
            );
            if (enrichedProps === f.properties) return f;
            return {
                ...f,
                properties: enrichedProps
            };
        });

        return {
            ...query.data,
            features
        };
    }, [query.data, query.dataUpdatedAt, byTripId, byVehicleId]);

    const { vehicleIndex, tripIndex } = useMemo(() => {
        const vIdx = new Map<string, VehicleFeature>();
        const tIdx = new Map<string, VehicleFeature>();
        
        if (enrichedCollection?.features) {
            for (const f of enrichedCollection.features) {
                if (f.properties.vehicle_id) vIdx.set(f.properties.vehicle_id, f);
                if (f.properties.gtfs_trip_id) tIdx.set(f.properties.gtfs_trip_id, f);
            }
        }
        return { vehicleIndex: vIdx, tripIndex: tIdx };
    }, [enrichedCollection]);

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
