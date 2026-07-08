import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { VehicleDetail, VehicleCollection, VehicleFeature } from '../../types/transit';
import { useRouteParams } from '../useRouteParams';
import { usePreferencesStore } from '../../state/preferencesStore';
import { TRANSIT_REFRESH_MS } from '../../config/constants';
import { apiFetch } from '../../lib/api-client';

const fetchVehicleDetail = async (city: string, vehicleId: string | null, tripId: string): Promise<VehicleDetail> => {
    const url = new URL(`/${city}/vehicle-detail`, window.location.origin);
    url.searchParams.set('tripId', tripId);
    if (vehicleId) {
        url.searchParams.set('vehicleId', vehicleId);
    }
    return apiFetch<VehicleDetail>(url.toString());
};

export const useVehicleDetail = () => {
    const { tripId, vehicleId } = useRouteParams();
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['vehicle-detail', selectedCity, vehicleId, tripId],
        queryFn: () => { return fetchVehicleDetail(selectedCity, vehicleId, tripId!); },
        enabled: !!tripId && !!selectedCity,
        staleTime: TRANSIT_REFRESH_MS,
        refetchInterval: TRANSIT_REFRESH_MS, // matches vehicle update frequency
        gcTime: 60000,
    });

    // Sync newer geometry and location data from vehicle detail back to the global stream
    // This prevents the vehicle jumping back to an old position when deselecting it
    useEffect(() => {
        if (query.data && query.data.geometry && selectedCity) {
            queryClient.setQueriesData({ queryKey: ['vehicles', selectedCity] }, (oldData: unknown) => {
                const old = oldData as VehicleCollection | undefined;
                if (!old || !old.features) return oldData;
                
                let updated = false;
                const updatedFeatures = old.features.map((f: VehicleFeature) => {
                    if ((vehicleId && f.properties.vehicle_id === vehicleId) || (!vehicleId && f.properties.gtfs_trip_id === tripId)) {
                        updated = true;
                        return {
                            ...f,
                            geometry: query.data.geometry,
                            properties: {
                                ...f.properties,
                                delay: query.data.delay ?? f.properties.delay,
                                bearing: query.data.bearing ?? f.properties.bearing,
                                state_position: query.data.state_position ?? f.properties.state_position,
                                last_stop_sequence: query.data.last_stop_sequence ?? f.properties.last_stop_sequence,
                            }
                        } as VehicleFeature;
                    }
                    return f;
                });
                
                return updated ? { ...old, features: updatedFeatures } : old;
            });
        }
    }, [query.data, queryClient, selectedCity, vehicleId, tripId]);

    return query;
};

