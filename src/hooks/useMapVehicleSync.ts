import { useEffect, useRef } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import type { SelectedStop, VehicleCollection, VehicleDetail } from '../types/transit';
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
    selectedId: string | null,
    selectedVehicle: VehicleDetail | null,
    setSelectedVehicle: (vehicle: VehicleDetail | null | ((prev: VehicleDetail | null) => VehicleDetail | null)) => void,
    isFollowing: boolean,
    rawVehicles?: VehicleCollection | null,
    vehicleDetail?: VehicleDetail | null,
    selectedStop?: SelectedStop | null
) => {
    const lastFlownId = useRef<string | null>(null);

    useEffect(() => {
        if (!selectedVehicle) return;

        const sid = selectedId;
        const stid = selectedVehicle.gtfs_trip_id;

        let updated = false;
        let newProps: Partial<VehicleDetail> = {};
        const currentCoords = selectedVehicle.geometry?.coordinates || [0, 0];
        let newCoords = [...currentCoords] as [number, number];

        // 1. Sync from high-frequency Map Stream
        // We look for the active vehicle in the latest GeoJSON batch from the map stream.
        // We match by vehicle_id (preferred) or gtfs_trip_id as a fallback.
        if (rawVehicles?.features) {
            const match = rawVehicles.features.find(f => {
                const props = f.properties;
                const fid = props.vehicle_id;
                const ftid = props.gtfs_trip_id;
                if (sid) return fid === sid;
                return ftid === stid;
            });

            if (match && match.geometry) {
                const p = match.properties;
                const coords = match.geometry.coordinates as [number, number];
                const matchId = p.vehicle_id;
                const tripIdChanged = p.gtfs_trip_id !== selectedVehicle.gtfs_trip_id;

                const hasValidLocation = coords[0] !== 0 || coords[1] !== 0;

                if (currentCoords[0] !== coords[0] || selectedVehicle.delay !== p.delay || tripIdChanged) {
                    updated = true;

                    if (tripIdChanged && selectedStop) {
                        // TRIP LOCK (DEPARTURE BOARD): If the user clicked a specific departure,
                        // we stay on that trip ID but we UPDATE the live properties (position, bearing, delay)
                        // so the map and "minutes late" remain live.
                        newProps = {
                            ...selectedVehicle,
                            vehicle_id: sid || matchId,
                            delay: p.delay,
                            bearing: p.bearing,
                            state_position: 'before_track',
                            last_stop_sequence: null
                        };
                    } else {
                        newProps = { ...p, vehicle_id: sid || matchId };
                    }

                    // Only update coordinates if they are valid, or if we currently have invalid ones
                    if (hasValidLocation || (currentCoords[0] === 0 && currentCoords[1] === 0)) {
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

            // Update if coordinates, delay, bearing, trip or sequence changed in the detail API
            const coordsChanged = detailCoords && (newCoords[0] !== detailCoords[0] || newCoords[1] !== detailCoords[1]);
            const bearingChanged = !isFallback && vehicleDetail.bearing !== undefined && selectedVehicle.bearing !== vehicleDetail.bearing;
            const tripIdChanged = vehicleDetail.gtfs_trip_id !== selectedVehicle.gtfs_trip_id;

            // LOSSLESS DELAY SYNC:
            // We only trust a "0" delay from the detail API if we don't already have a non-zero delay
            // from the map stream or departure board. This prevents the "reverts to on-time" bug.
            const currentDelay = newProps.delay ?? selectedVehicle.delay ?? 0;
            const detailDelayValue = detailDelay ?? 0;
            const shouldUpdateDelay = !isFallback && (detailDelayValue !== 0 || currentDelay === 0);
            const delayChanged = shouldUpdateDelay && currentDelay !== detailDelayValue;

            const sequenceChanged = !isFallback && vehicleDetail.last_stop_sequence !== undefined && selectedVehicle.last_stop_sequence !== vehicleDetail.last_stop_sequence;

            const routeInfoChanged =
                (vehicleDetail.route_short_name !== undefined && selectedVehicle.route_short_name !== vehicleDetail.route_short_name) ||
                (vehicleDetail.route_type !== undefined && selectedVehicle.route_type !== vehicleDetail.route_type) ||
                (vehicleDetail.trip_headsign !== undefined && selectedVehicle.trip_headsign !== vehicleDetail.trip_headsign);

            if (coordsChanged || delayChanged || bearingChanged || sequenceChanged || tripIdChanged || routeInfoChanged) {
                updated = true;
                // Only update coordinates if they are valid, or if we currently have invalid ones
                if (hasValidDetailLocation || (newCoords[0] === 0 && newCoords[1] === 0)) {
                    if (detailCoords) newCoords = detailCoords;
                }

                if (tripIdChanged && selectedStop) {
                    // TRIP LOCK (API): Preserve selected trip identity but update position, bearing and delay.
                    newProps = {
                        ...newProps,
                        delay: detailDelayValue,
                        bearing: vehicleDetail.bearing ?? newProps.bearing,
                        state_position: 'before_track',
                        last_stop_sequence: null
                    };
                } else {
                    newProps = {
                        ...newProps,
                        gtfs_trip_id: vehicleDetail.gtfs_trip_id || newProps.gtfs_trip_id,
                        delay: shouldUpdateDelay ? detailDelayValue : currentDelay,
                        bearing: isFallback
                            ? (tripIdChanged ? null : (newProps.bearing ?? selectedVehicle.bearing))
                            : (vehicleDetail.bearing ?? newProps.bearing),
                        state_position: isFallback
                            ? (tripIdChanged ? 'on_track' : (newProps.state_position ?? selectedVehicle.state_position))
                            : (vehicleDetail.state_position || newProps.state_position),
                        last_stop_sequence: isFallback
                            ? (tripIdChanged ? null : (newProps.last_stop_sequence ?? selectedVehicle.last_stop_sequence))
                            : (vehicleDetail.last_stop_sequence ?? (tripIdChanged ? null : newProps.last_stop_sequence)),
                        origin_timestamp: isFallback
                            ? (tripIdChanged ? undefined : (newProps.origin_timestamp ?? selectedVehicle.origin_timestamp))
                            : (vehicleDetail.origin_timestamp || newProps.origin_timestamp),
                        route_short_name: vehicleDetail.route_short_name || newProps.route_short_name || selectedVehicle.route_short_name,
                        route_type: vehicleDetail.route_type ?? newProps.route_type ?? selectedVehicle.route_type,
                        trip_headsign: vehicleDetail.trip_headsign || newProps.trip_headsign || selectedVehicle.trip_headsign,
                        vehicle_descriptor: {
                            ...(newProps.vehicle_descriptor || selectedVehicle.vehicle_descriptor),
                            vehicle_registration_number: vehicleDetail.vehicle_descriptor?.vehicle_registration_number || newProps.vehicle_descriptor?.vehicle_registration_number || selectedVehicle.vehicle_descriptor?.vehicle_registration_number
                        }
                    };
                }
            }
        }

        if (updated) {
            setSelectedVehicle((prev: VehicleDetail | null) => {
                if (!prev) return null;
                const prevCoords = prev.geometry?.coordinates || [0, 0];
                // Deep equality check for properties that trigger updates
                const hasGeometryChanged = prevCoords[0] !== newCoords[0] || prevCoords[1] !== newCoords[1];
                const hasDelayChanged = newProps.delay !== undefined && prev.delay !== newProps.delay;
                const hasBearingChanged = newProps.bearing !== undefined && prev.bearing !== newProps.bearing;
                const hasSequenceChanged = newProps.last_stop_sequence !== undefined && prev.last_stop_sequence !== newProps.last_stop_sequence;
                const hasStateChanged = newProps.state_position !== undefined && prev.state_position !== newProps.state_position;
                const hasOriginChanged = newProps.origin_timestamp !== undefined && prev.origin_timestamp !== newProps.origin_timestamp;
                const hasTripChanged = newProps.gtfs_trip_id !== undefined && prev.gtfs_trip_id !== newProps.gtfs_trip_id;
                const hasRouteInfoChanged =
                    (newProps.route_short_name !== undefined && prev.route_short_name !== newProps.route_short_name) ||
                    (newProps.route_type !== undefined && prev.route_type !== newProps.route_type);

                if (!hasGeometryChanged && !hasDelayChanged && !hasBearingChanged && !hasSequenceChanged && !hasStateChanged && !hasTripChanged && !hasOriginChanged && !hasRouteInfoChanged) {
                    return prev;
                }

                return {
                    ...prev,
                    ...newProps,
                    geometry: {
                        type: 'Point',
                        coordinates: newCoords
                    }
                } as VehicleDetail;
            });
        }

        // Map movement: Focus on vehicle when coordinates are found
        const hasCoords = newCoords[0] !== 0 || newCoords[1] !== 0;
        const currentId = selectedId || selectedVehicle.gtfs_trip_id;
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
