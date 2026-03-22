import { useEffect, useRef } from 'react';
import type { VehicleCollection, VehicleDetail, SelectedStop, StopCollection } from '../types/transit';
import { syncVehicleProperties } from '../utils/vehicleSyncUtils';

/**
 * useMapSync
 *
 * Synchronizes the internal map state with external data sources:
 * 1. Merges real-time vehicle stream data with detail API data.
 * 2. Enriches selected stop data with coordinates and names from the local GeoJSON cache.
 */
export const useMapSync = (
    state: {
        selectedId: string | null;
        selectedVehicle: VehicleDetail | null;
        selectedStop: SelectedStop | null;
    },
    actions: {
        setSelectedVehicle: (vehicle: VehicleDetail | null | ((prev: VehicleDetail | null) => VehicleDetail | null)) => void;
        setSelectedStop: (stop: SelectedStop | null | ((prev: SelectedStop | null) => SelectedStop | null)) => void;
    },
    data: {
        rawVehicles?: VehicleCollection | null;
        vehicleDetail?: VehicleDetail | null;
        stopsData?: StopCollection | null;
    }
) => {
    const { selectedId, selectedVehicle, selectedStop } = state;
    const { setSelectedVehicle, setSelectedStop } = actions;
    const { rawVehicles, vehicleDetail, stopsData } = data;

    const lastEnrichedId = useRef<string | null>(null);

    // --- 1. VEHICLE DATA SYNC ---
    useEffect(() => {
        if (!selectedVehicle) {
            return;
        }

        const { updated, merged } = syncVehicleProperties(
            selectedVehicle,
            rawVehicles,
            vehicleDetail,
            selectedId
        );

        if (updated) {
            setSelectedVehicle(() => {
                return merged;
            });
        }
    }, [rawVehicles, vehicleDetail, selectedId, selectedVehicle, setSelectedVehicle]);

    // --- 2. STOP DATA ENRICHMENT ---
    useEffect(() => {
        if (!selectedStop || !stopsData || lastEnrichedId.current === selectedStop.stop_id) {
            return;
        }

        const { stop_id, stop_name, coordinates } = selectedStop;
        if (stop_name && coordinates) {
            lastEnrichedId.current = stop_id;
            return;
        }

        const feature = stopsData.features.find((f) => {
            return f.properties.stop_id === stop_id || f.properties.all_ids?.includes(stop_id);
        });

        if (feature) {
            const { stop_name: name, platform_code, all_ids } = feature.properties;
            setSelectedStop((prev) => {
                return prev?.stop_id === stop_id ? {
                    ...prev,
                    stop_name: prev.stop_name || name,
                    platform_code: prev.platform_code || platform_code,
                    coordinates: prev.coordinates || (feature.geometry.coordinates as [number, number]),
                    all_ids: all_ids
                } : prev;
            });
            lastEnrichedId.current = stop_id;
        }
    }, [selectedStop, stopsData, setSelectedStop]);
};
