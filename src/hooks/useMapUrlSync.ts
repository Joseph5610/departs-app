import { useEffect, useRef } from 'react';
import type { SelectedStop, VehicleDetail } from '../types/transit';

/**
 * useMapUrlSync
 *
 * Synchronizes selected stop and vehicle state with the URL.
 * Handles initial state restoration from URL search parameters.
 */
export const useMapUrlSync = (
    selectedStop: SelectedStop | null,
    setSelectedStop: (stop: SelectedStop | null) => void,
    selectedVehicle: VehicleDetail | null,
    selectVehicle: (vehicle: VehicleDetail | null, keepStop?: boolean) => void
) => {
    const initialized = useRef(false);

    // Initial Load
    useEffect(() => {
        if (initialized.current) {
            return;
        }
        const p = new URLSearchParams(window.location.search);

        const stopId = p.get('stopId');
        if (stopId && !selectedStop) {
            setSelectedStop({ stop_id: stopId, stop_name: '' });
        }

        const tripId = p.get('tripId');
        const vehicleId = p.get('vehicleId');
        if (tripId && !selectedVehicle) {
            selectVehicle({
                vehicle_id: vehicleId || null,
                gtfs_trip_id: tripId,
                state_position: 'on_track',
                geometry: { type: 'Point', coordinates: [0, 0] }
            } as VehicleDetail, !!stopId);
        }

        initialized.current = true;
    }, [setSelectedStop, selectedStop, selectedVehicle, selectVehicle]);

    // Update URL on state change
    useEffect(() => {
        const url = new URL(window.location.href);
        const sp = url.searchParams;

        if (selectedStop) {
            sp.set('stopId', selectedStop.stop_id);
        } else {
            sp.delete('stopId');
        }

        if (selectedVehicle) {
            if (selectedVehicle.vehicle_id) {
                sp.set('vehicleId', selectedVehicle.vehicle_id);
            } else {
                sp.delete('vehicleId');
            }
            sp.set('tripId', selectedVehicle.gtfs_trip_id);
        } else {
            sp.delete('vehicleId');
            sp.delete('tripId');
        }

        window.history.replaceState({}, '', url.toString());
    }, [selectedStop, selectedVehicle]);
};
