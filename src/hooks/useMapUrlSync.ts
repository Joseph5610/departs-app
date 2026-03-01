import { useEffect, useRef } from 'react';
import type { SelectedStop, TrackedVehicle } from '../types/transit';

/**
 * Syncs the selected stop and map camera position with browser URL search parameters.
 * Allows for shareable links and state persistence on refresh.
 */
export const useMapUrlSync = (
    selectedStop: SelectedStop | null,
    setSelectedStop: (stop: SelectedStop | null | ((prev: SelectedStop | null) => SelectedStop | null)) => void,
    selectedVehicle: TrackedVehicle | null,
    selectVehicle: (vehicle: TrackedVehicle | null, keepStop?: boolean) => void
) => {
    const initialized = useRef(false);

    // 1. Initial Load: Read from URL
    useEffect(() => {
        if (initialized.current) return;

        const p = new URLSearchParams(window.location.search);

        // Stop handling
        const id = p.get('stopId');
        const name = p.get('stopName');
        const platform = p.get('stopPlatform');

        if (id && name && !selectedStop) {
            let finalName = name;
            let finalPlatform = platform;

            // Backward compatibility: Extract platform from name if it follows "Name (A)" format
            if (!finalPlatform) {
                const match = name.match(/(.+)\s\((.+)\)$/);
                if (match) {
                    finalName = match[1];
                    finalPlatform = match[2];
                }
            }

            setSelectedStop({ id, name: finalName, platformCode: finalPlatform || undefined });
        }

        // Vehicle handling
        const tripId = p.get('tripId');
        const vehId = p.get('vehId');
        const line = p.get('line');
        const headsign = p.get('headsign');
        const routeTypeRaw = p.get('routeType');
        const routeType = routeTypeRaw ? parseInt(routeTypeRaw, 10) : undefined;

        if (tripId && !selectedVehicle) {
            selectVehicle({
                vehicle_id: vehId || `trip-${tripId}`,
                gtfs_trip_id: tripId,
                trip_id: tripId,
                gtfs_route_short_name: line || undefined,
                route_type: !isNaN(routeType as number) ? routeType : undefined,
                gtfs_trip_headsign: headsign || undefined,
                _geometry: [0, 0],
                bearing: null
            }, !!id); // keep stop if stopId is present
        }

        initialized.current = true;
    }, [setSelectedStop, selectedStop, selectVehicle, selectedVehicle]);

    // 2. State Change: Write to URL
    useEffect(() => {
        const url = new URL(window.location.href);

        // Stop handling
        if (selectedStop) {
            url.searchParams.set('stopId', selectedStop.id);
            url.searchParams.set('stopName', selectedStop.name);
            if (selectedStop.platformCode) {
                url.searchParams.set('stopPlatform', selectedStop.platformCode);
            } else {
                url.searchParams.delete('stopPlatform');
            }
        } else {
            url.searchParams.delete('stopId');
            url.searchParams.delete('stopName');
            url.searchParams.delete('stopPlatform');
        }

        // Vehicle handling
        if (selectedVehicle) {
            url.searchParams.set('tripId', selectedVehicle.gtfs_trip_id || '');
            if (selectedVehicle.vehicle_id && !selectedVehicle.vehicle_id.startsWith('trip-')) {
                url.searchParams.set('vehId', selectedVehicle.vehicle_id);
            } else {
                url.searchParams.delete('vehId');
            }
            if (selectedVehicle.gtfs_route_short_name || selectedVehicle.route_short_name) {
                url.searchParams.set('line', selectedVehicle.gtfs_route_short_name || selectedVehicle.route_short_name || '');
            }
            if (selectedVehicle.gtfs_trip_headsign || selectedVehicle.trip_headsign) {
                url.searchParams.set('headsign', selectedVehicle.gtfs_trip_headsign || selectedVehicle.trip_headsign || '');
            }
            if (selectedVehicle.route_type !== undefined) {
                url.searchParams.set('routeType', String(selectedVehicle.route_type));
            }
        } else {
            url.searchParams.delete('tripId');
            url.searchParams.delete('vehId');
            url.searchParams.delete('line');
            url.searchParams.delete('headsign');
            url.searchParams.delete('routeType');
        }

        window.history.replaceState({}, '', url.toString());
    }, [selectedStop, selectedVehicle]);
};
