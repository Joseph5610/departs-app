import { useMemo } from 'react';
import { useOverlayNetworks } from '@/hooks/data/useOverlayNetworks';
import { useNetworksInView } from './useNetworksInView';
import { useSelectedVehicle } from './useSelectedVehicle';
import { twinVehicleOf } from '@/domain/vehicles';
import { SHARED_GROUND } from '@/config/constants';

export interface VehicleTwin {
    city: string;
    tripId: string;
    vehicleId: string | null;
}

/** The same vehicle as reported by another network shown on the map (PID and DÚK both report the lines between them). */
export const useVehicleTwin = (): VehicleTwin | null => {
    const vehicle = useSelectedVehicle();
    const networks = useNetworksInView();
    const overlay = useOverlayNetworks(networks).vehicles;

    return useMemo(() => {
        if (!vehicle) return null;
        const twin = twinVehicleOf(vehicle, vehicle.geometry?.coordinates, overlay, SHARED_GROUND.TWIN_VEHICLE);
        const city = twin?.properties.city_slug;
        return twin && city && twin.properties.gtfs_trip_id
            ? { city, tripId: twin.properties.gtfs_trip_id, vehicleId: twin.properties.vehicle_id ?? null }
            : null;
    }, [vehicle, overlay]);
};
