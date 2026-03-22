import { useEffect, useRef } from 'react';
import type { SelectedStop, VehicleDetail } from '../types/transit';

/**
 * Syncs the selected stop, vehicle and map camera position with browser URL search parameters.
 * Allows for shareable links and state persistence on refresh.
 */
export const useMapUrlSync = (
    selectedStop: SelectedStop | null,
    setSelectedStop: (stop: SelectedStop | null | ((prev: SelectedStop | null) => SelectedStop | null)) => void,
    selectedVehicle: VehicleDetail | null,
    selectVehicle: (vehicle: VehicleDetail | null, keepStop?: boolean) => void
) => {
    const initialized = useRef(false);

    // 1. Initial Load: Read from URL
    useEffect(() => {
        if (initialized.current) return;

        const p = new URLSearchParams(window.location.search);

        // Stop Sync
        const stopId = p.get('stopId');

        if (stopId && !selectedStop) {
            setSelectedStop({ stop_id: stopId, stop_name: '' }); // stop_name will be enriched by useMapStopEnrichment
        }

        // Vehicle Sync
        const vehicleId = p.get('vehicleId');
        const tripId = p.get('tripId');
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

    // 2. State Change: Write to URL
    useEffect(() => {
        const url = new URL(window.location.href);

        // Stop params
        if (selectedStop) {
            url.searchParams.set('stopId', selectedStop.stop_id);
        } else {
            url.searchParams.delete('stopId');
        }
        url.searchParams.delete('stopName');
        url.searchParams.delete('stopPlatform');

        // Vehicle params
        if (selectedVehicle) {
            if (selectedVehicle.vehicle_id) {
                url.searchParams.set('vehicleId', selectedVehicle.vehicle_id);
            } else {
                url.searchParams.delete('vehicleId');
            }
            url.searchParams.set('tripId', selectedVehicle.gtfs_trip_id || '');
        } else {
            url.searchParams.delete('vehicleId');
            url.searchParams.delete('tripId');
            url.searchParams.delete('line');
            url.searchParams.delete('headsign');
            url.searchParams.delete('delay');
        }

        window.history.replaceState({}, '', url.toString());
    }, [selectedStop, selectedVehicle]);
};
