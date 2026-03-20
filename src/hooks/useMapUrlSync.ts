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
        const stopName = p.get('stopName');
        const stopPlatform = p.get('stopPlatform');

        if (stopId && stopName && !selectedStop) {
            let finalName = stopName;
            let finalPlatform = stopPlatform;

            // Backward compatibility: Extract platform from name if it follows "Name (A)" format
            if (!finalPlatform) {
                const match = stopName.match(/(.+)\s\((.+)\)$/);
                if (match) {
                    finalName = match[1];
                    finalPlatform = match[2];
                }
            }

            setSelectedStop({ stop_id: stopId, stop_name: finalName, platform_code: finalPlatform || undefined });
        }

        // Vehicle Sync
        const vehicleId = p.get('vehicleId');
        const tripId = p.get('tripId');
        if (vehicleId && tripId && !selectedVehicle) {
            selectVehicle({
                vehicle_id: vehicleId,
                gtfs_trip_id: tripId,
                route_short_name: p.get('line') || '',
                trip_headsign: p.get('headsign') || '',
                delay: Number(p.get('delay') || 0),
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
            url.searchParams.set('stopName', selectedStop.stop_name);
            if (selectedStop.platform_code) {
                url.searchParams.set('stopPlatform', selectedStop.platform_code);
            } else {
                url.searchParams.delete('stopPlatform');
            }
        } else {
            url.searchParams.delete('stopId');
            url.searchParams.delete('stopName');
            url.searchParams.delete('stopPlatform');
        }

        // Vehicle params
        if (selectedVehicle) {
            url.searchParams.set('vehicleId', selectedVehicle.vehicle_id);
            url.searchParams.set('tripId', selectedVehicle.gtfs_trip_id || '');
            if (selectedVehicle.route_short_name) url.searchParams.set('line', selectedVehicle.route_short_name);
            if (selectedVehicle.trip_headsign) url.searchParams.set('headsign', selectedVehicle.trip_headsign);
            if (selectedVehicle.delay !== undefined) url.searchParams.set('delay', String(selectedVehicle.delay));
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
