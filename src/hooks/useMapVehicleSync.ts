import { useEffect, useRef } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import type { VehicleCollection, TrackedVehicle, VehicleDetail } from '../types/transit';
import { MAP_VEHICLE_SELECT_ZOOM, MAP_ANIMATION_DURATION, MOBILE_BREAKPOINT, MOBILE_BOTTOM_SHEET_RATIO, SIDEBAR_WIDTH } from '../config/constants';

/**
 * The 'Motor' of the map tracking system.
 * Keeps the selected vehicle state synchronized between two distinct data sources:
 * 1. MAP STREAM (rawVehicles): High-frequency GeoJSON updates (position, speed).
 * 2. DETAIL API (vehicleDetail): Low-frequency REST updates (operator, amenities, full schedule).
 *
 * It ensures that even if a vehicle is re-jittered or updated in the background, 
 * the UI's selected state remains accurate.
 */
export const useMapVehicleSync = (
    mapRef: React.RefObject<MapRef | null>,
    selectedId: string | number | null,
    selectedVehicle: TrackedVehicle | null,
    setSelectedVehicle: (vehicle: TrackedVehicle | null | ((prev: TrackedVehicle | null) => TrackedVehicle | null)) => void,
    isFollowing: boolean,
    rawVehicles?: VehicleCollection | null,
    vehicleDetail?: VehicleDetail | null
) => {
    const lastFlownId = useRef<string | null>(null);

    useEffect(() => {
        if (!selectedId || !selectedVehicle) return;

        const sid = String(selectedId);
        const stid = String(selectedVehicle.gtfs_trip_id || 'NONE');

        let updated = false;
        let newProps: Partial<TrackedVehicle> = {};
        let newCoords = selectedVehicle._geometry;

        // 1. Sync from high-frequency Map Stream
        // We look for the active vehicle in the latest GeoJSON batch from the map stream.
        // We match by vehicle_id (preferred) or gtfs_trip_id as a fallback.
        if (rawVehicles?.features) {
            const match = rawVehicles.features.find(f => {
                const props = f.properties;
                const fid = String(props.vehicle_id);
                const ftid = String(props.gtfs_trip_id || '');
                if (sid !== 'NONE' && !sid.startsWith('trip-')) return fid === sid;
                return ftid === stid && stid !== 'NONE';
            });

            if (match && match.geometry) {
                const p = match.properties;
                const coords = match.geometry.coordinates as [number, number];
                const matchId = String(p.vehicle_id);

                const hasValidLocation = coords[0] !== 0 || coords[1] !== 0;

                if (selectedVehicle._geometry[0] !== coords[0] || selectedVehicle.delay !== p.delay) {
                    updated = true;
                    newProps = { ...p, vehicle_id: sid.startsWith('trip-') ? matchId : sid };
                    // Only update coordinates if they are valid, or if we currently have invalid ones
                    if (hasValidLocation || (selectedVehicle._geometry[0] === 0 && selectedVehicle._geometry[1] === 0)) {
                        newCoords = coords;
                    }
                }
            }
        }

        // 2. Sync from Direct Detail API
        // If we have detailed info for the selected vehicle, use it to update position and properties.
        if (vehicleDetail) {
            const isFallback = vehicleDetail.is_static_fallback;
            const detailCoords = vehicleDetail.geometry?.coordinates as [number, number] | undefined;
            const detailDelay = vehicleDetail.delay;
            const hasValidDetailLocation = detailCoords && (detailCoords[0] !== 0 || detailCoords[1] !== 0);

            // Update if coordinates, delay or sequence changed in the detail API
            const coordsChanged = detailCoords && (newCoords[0] !== detailCoords[0] || newCoords[1] !== detailCoords[1]);

            // LOSSLESS DELAY SYNC:
            // We only trust a "0" delay from the detail API if we don't already have a non-zero delay
            // from the map stream or departure board. This prevents the "reverts to on-time" bug.
            const currentDelay = newProps.delay ?? selectedVehicle.delay ?? 0;
            const detailDelayValue = detailDelay ?? 0;
            const shouldUpdateDelay = !isFallback && (detailDelayValue !== 0 || currentDelay === 0);
            const delayChanged = shouldUpdateDelay && currentDelay !== detailDelayValue;

            const sequenceChanged = !isFallback && vehicleDetail.last_stop_sequence !== undefined && selectedVehicle.last_stop_sequence !== vehicleDetail.last_stop_sequence;

            if (coordsChanged || delayChanged || sequenceChanged) {
                updated = true;
                // Only update coordinates if they are valid, or if we currently have invalid ones
                if (hasValidDetailLocation || (newCoords[0] === 0 && newCoords[1] === 0)) {
                    if (detailCoords) newCoords = detailCoords;
                }

                newProps = {
                    ...newProps,
                    delay: shouldUpdateDelay ? detailDelayValue : currentDelay,
                    state_position: isFallback ? (newProps.state_position ?? selectedVehicle.state_position) : (vehicleDetail.state_position || newProps.state_position),
                    last_stop_sequence: isFallback ? (newProps.last_stop_sequence ?? selectedVehicle.last_stop_sequence) : (vehicleDetail.last_stop_sequence ?? newProps.last_stop_sequence),
                    vehicle_descriptor: {
                        ...(newProps.vehicle_descriptor || selectedVehicle.vehicle_descriptor),
                        vehicle_registration_number: vehicleDetail.vehicle_descriptor?.vehicle_registration_number || newProps.vehicle_descriptor?.vehicle_registration_number || selectedVehicle.vehicle_descriptor?.vehicle_registration_number
                    }
                };
            }
        }

        if (updated) {
            setSelectedVehicle((prev: TrackedVehicle | null) => {
                if (!prev) return null;
                // Deep equality check for properties that trigger updates
                const hasGeometryChanged = prev._geometry[0] !== newCoords[0] || prev._geometry[1] !== newCoords[1];
                const hasDelayChanged = prev.delay !== (newProps.delay ?? prev.delay);
                const hasSequenceChanged = prev.last_stop_sequence !== (newProps.last_stop_sequence ?? prev.last_stop_sequence);
                const hasStateChanged = prev.state_position !== (newProps.state_position ?? prev.state_position);

                if (!hasGeometryChanged && !hasDelayChanged && !hasSequenceChanged && !hasStateChanged) {
                    return prev;
                }

                return { ...prev, ...newProps, _geometry: newCoords } as TrackedVehicle;
            });
        }

        // Map movement: Focus on vehicle when coordinates are found
        const hasCoords = newCoords[0] !== 0 || newCoords[1] !== 0;
        const currentId = String(selectedId);
        if (hasCoords && lastFlownId.current !== currentId) {
            lastFlownId.current = currentId;
            const isMobile = typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false;
            mapRef.current?.flyTo({
                center: newCoords,
                zoom: MAP_VEHICLE_SELECT_ZOOM,
                duration: MAP_ANIMATION_DURATION,
                essential: true,
                padding: isMobile
                    ? { bottom: window.innerHeight / MOBILE_BOTTOM_SHEET_RATIO, top: 0, left: 0, right: 0 }
                    : { bottom: 0, top: 0, left: SIDEBAR_WIDTH, right: 0 }
            });
        }
    }, [rawVehicles, vehicleDetail, isFollowing, selectedId, selectedVehicle, setSelectedVehicle, mapRef]);
};
