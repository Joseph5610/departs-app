import { useEffect, useRef } from 'react';
import { useMap } from './useMap';
import { useVehicles } from './useVehicles';
import type { SelectedStop } from '../types/transit';
import { useVehicleDetail } from './useVehicleDetail';
import { useStops } from './useStops';

/**
 * useMapSync
 *
 * The "Data Coordinator" hook.
 *
 * Semantically, this hook acts as a bridge between asynchronous external data sources
 * and the application's central state. It ensures that the 'selected' objects in the
 * reducer are always enriched with the latest available information.
 */
export const useMapSync = () => {
    const { state, actions } = useMap();
    const { selectedId, selectedVehicle, selectedStop } = state;
    const { updateVehicle, updateStop } = actions;

    const { vehicles: rawVehicles } = useVehicles();
    const { data: vehicleDetail } = useVehicleDetail();
    const { _raw_data: stopsData } = useStops();

    const lastEnrichedId = useRef<string | null>(null);

    // --- 1. VEHICLE DATA SYNC ---
    /**
     * Synchronizes the currently selected vehicle with the latest real-time data.
     * It uses a declarative merge strategy:
     * - Base: Current selected vehicle state
     * - Layer 1: Properties from the high-frequency Map Stream (rawVehicles)
     * - Layer 2: Properties from the low-frequency Detail API (vehicleDetail)
     *
     * Special logic is applied for 'static fallbacks' where real-time data is missing,
     * ensuring we don't overwrite live positions with outdated static schedule info.
     */
    useEffect(() => {
        if (!selectedVehicle) {
            return;
        }

        const liveMatch = rawVehicles?.features?.find((f) => {
            if (selectedId) {
                return f.properties.vehicle_id === selectedId;
            }
            return f.properties.gtfs_trip_id === selectedVehicle.gtfs_trip_id;
        });

        const isFallback = !!vehicleDetail?.is_static_fallback;

        // Declarative merge: Base -> Live Stream -> API Detail
        const merged = {
            ...selectedVehicle,
            ...(liveMatch?.properties || {}),
            ...(vehicleDetail || {}),
            // Safety: Never nullify essential identifiers
            vehicle_id: selectedId || vehicleDetail?.vehicle_id || liveMatch?.properties.vehicle_id || selectedVehicle.vehicle_id,
            gtfs_trip_id: vehicleDetail?.gtfs_trip_id || liveMatch?.properties.gtfs_trip_id || selectedVehicle.gtfs_trip_id,
            // Safety: Deep descriptor merge
            vehicle_descriptor: {
                ...(selectedVehicle.vehicle_descriptor || {}),
                ...(liveMatch?.properties.vehicle_descriptor || {}),
                ...(vehicleDetail?.vehicle_descriptor || {})
            }
        };

        // Static Fallback overrides: Preserve current live state if API return is just static data
        if (isFallback) {
            merged.delay = selectedVehicle.delay;
            merged.bearing = selectedVehicle.bearing;
            merged.state_position = selectedVehicle.state_position;
            merged.last_stop_sequence = selectedVehicle.last_stop_sequence;
        }

        // Geometry: Prioritize newest valid coordinates
        const dg = vehicleDetail?.geometry;
        const sg = liveMatch?.geometry;
        const isValid = (g: any) => {
            return g?.coordinates && (g.coordinates[0] !== 0 || g.coordinates[1] !== 0);
        };

        if (isValid(dg)) {
            merged.geometry = dg;
        } else if (isValid(sg)) {
            merged.geometry = sg;
        }

        if (JSON.stringify(selectedVehicle) !== JSON.stringify(merged)) {
            updateVehicle(merged);
        }
    }, [rawVehicles, vehicleDetail, selectedId, selectedVehicle, updateVehicle]);

    // --- 2. STOP DATA ENRICHMENT ---
    /**
     * Hydrates a partially loaded stop (e.g. from a URL or minimal search result)
     * with full metadata from the GeoJSON stop collection once it's available.
     */
    useEffect(() => {
        if (!selectedStop || !stopsData || lastEnrichedId.current === selectedStop.stop_id) {
            return;
        }

        if (selectedStop.stop_name && selectedStop.coordinates) {
            lastEnrichedId.current = selectedStop.stop_id;
            return;
        }

        const feature = stopsData.features.find((f) => {
            return f.properties.stop_id === selectedStop.stop_id || f.properties.all_ids?.includes(selectedStop.stop_id);
        });

        if (feature) {
            updateStop((prev: SelectedStop | null) => {
                if (prev?.stop_id !== selectedStop.stop_id) {
                    return prev;
                }
                return {
                    ...prev,
                    stop_name: prev.stop_name || feature.properties.stop_name,
                    platform_code: prev.platform_code || feature.properties.platform_code,
                    coordinates: prev.coordinates || (feature.geometry.coordinates as [number, number]),
                    all_ids: feature.properties.all_ids
                };
            });
            lastEnrichedId.current = selectedStop.stop_id;
        }
    }, [selectedStop, stopsData, updateStop]);
};
