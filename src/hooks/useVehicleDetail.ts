import { useQuery } from '@tanstack/react-query';

export interface VehicleDetail {
    gtfs_trip_id: string;
    route_short_name: string;
    trip_headsign: string;
    delay: number;
    state_position: string;
    last_stop_sequence?: number;
    origin_timestamp?: string;
    run_number?: number;
    vehicle_id?: string;
    vehicle_descriptor?: {
        operator?: string;
        vehicle_type?: string;
        is_wheelchair_accessible?: boolean;
        is_air_conditioned?: boolean;
        has_usb_chargers?: boolean;
        vehicle_registration_number?: string;
    };
    stop_times?: {
        features: Array<{
            properties: {
                stop_name: string;
                stop_sequence: number;
                arrival_time: string;
                realtime_arrival_time?: string;
                departure_time?: string;
                realtime_departure_time?: string;
            };
        }>;
    };
    shapes?: number[][]; // Optimized: [[lng, lat], [lng, lat], ...]
}

const fetchVehicleDetail = async (vehicleId: string, tripId: string): Promise<VehicleDetail> => {
    const res = await fetch(`/api/vehicle-detail?vehicleId=${vehicleId}&tripId=${tripId}`);
    if (!res.ok) throw new Error('Failed to fetch vehicle detail');
    return res.json();
};

export const useVehicleDetail = (vehicleId: string | null, tripId: string | null) => {
    return useQuery({
        queryKey: ['vehicle-detail', vehicleId, tripId],
        queryFn: () => fetchVehicleDetail(vehicleId!, tripId!),
        enabled: !!vehicleId && !!tripId,
        staleTime: 0,
        refetchInterval: 10000, // 10s - matches vehicle update frequency
        gcTime: 60000,
    });
};
