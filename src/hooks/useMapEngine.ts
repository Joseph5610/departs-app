import { useEffect, useRef } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import type { VehicleCollection, VehicleDetail, SelectedStop, StopCollection } from '../types/transit';
import {
    MAP_VEHICLE_SELECT_ZOOM,
    MAP_ANIMATION_DURATION,
    MOBILE_BREAKPOINT,
    MOBILE_BOTTOM_SHEET_RATIO,
    SIDEBAR_WIDTH
} from '../config/constants';

/**
 * useMapEngine
 *
 * Consolidated hook that handles:
 * 1. Vehicle State Sync (between stream and detail API)
 * 2. Camera Following (tracking selected vehicle or stop)
 * 3. Vehicle Animations (pulsing effect)
 * 4. URL Synchronization (initial load and updates)
 * 5. Stop Data Enrichment (filling missing info for stopId from URL)
 */
export const useMapEngine = (
    mapRef: React.RefObject<MapRef | null>,
    state: {
        selectedId: string | null;
        selectedVehicle: VehicleDetail | null;
        selectedStop: SelectedStop | null;
        isFollowing: boolean;
    },
    actions: {
        setSelectedVehicle: (vehicle: VehicleDetail | null | ((prev: VehicleDetail | null) => VehicleDetail | null)) => void;
        setSelectedStop: (stop: SelectedStop | null | ((prev: SelectedStop | null) => SelectedStop | null)) => void;
        selectVehicle: (vehicle: VehicleDetail | null, keepStop?: boolean) => void;
    },
    data: {
        rawVehicles?: VehicleCollection | null;
        vehicleDetail?: VehicleDetail | null;
        stopsData?: StopCollection | null;
    }
) => {
    const { selectedId, selectedVehicle, selectedStop, isFollowing } = state;
    const { setSelectedVehicle, setSelectedStop, selectVehicle } = actions;
    const { rawVehicles, vehicleDetail, stopsData } = data;

    const lastFlownId = useRef<string | null>(null);
    const initialized = useRef(false);
    const lastEnrichedId = useRef<string | null>(null);

    // --- 1. INITIAL URL LOAD ---
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

    // --- 2. URL SYNC (Write) ---
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

    // --- 3. STOP DATA ENRICHMENT ---
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

    // --- 4. VEHICLE STATE SYNC ---
    useEffect(() => {
        if (!selectedVehicle) {
            return;
        }

        const sid = selectedId;
        const stid = selectedVehicle.gtfs_trip_id;

        let updated = false;
        let newProps: Partial<VehicleDetail> = {};
        const currentCoords = selectedVehicle.geometry?.coordinates || [0, 0];
        let newCoords = [...currentCoords] as [number, number];

        // Sync from Map Stream
        if (rawVehicles?.features) {
            const match = rawVehicles.features.find((f) => {
                const props = f.properties;
                if (sid) {
                    return props.vehicle_id === sid;
                }
                return props.gtfs_trip_id === stid;
            });

            if (match && match.geometry) {
                const p = match.properties;
                const coords = match.geometry.coordinates as [number, number];
                const tripIdChanged = p.gtfs_trip_id !== selectedVehicle.gtfs_trip_id;
                const hasValidLocation = coords[0] !== 0 || coords[1] !== 0;

                if (currentCoords[0] !== coords[0] || selectedVehicle.delay !== p.delay || tripIdChanged) {
                    updated = true;
                    newProps = { ...p, vehicle_id: sid || p.vehicle_id };
                    if (tripIdChanged && p.last_stop_sequence === undefined) {
                        newProps.last_stop_sequence = null;
                    }
                    if (hasValidLocation || (currentCoords[0] === 0 && currentCoords[1] === 0)) {
                        newCoords = coords;
                    }
                }
            }
        }

        // Sync from Detail API
        if (vehicleDetail) {
            const isFallback = vehicleDetail.is_static_fallback;
            const detailCoords = vehicleDetail.geometry?.coordinates as [number, number] | undefined;
            const hasValidDetailLocation = detailCoords && (detailCoords[0] !== 0 || detailCoords[1] !== 0);

            const coordsChanged = detailCoords && (newCoords[0] !== detailCoords[0] || newCoords[1] !== detailCoords[1]);
            const bearingChanged = !isFallback && vehicleDetail.bearing !== undefined && selectedVehicle.bearing !== vehicleDetail.bearing;
            const tripIdChanged = vehicleDetail.gtfs_trip_id !== selectedVehicle.gtfs_trip_id;

            const currentDelay = newProps.delay ?? selectedVehicle.delay ?? 0;
            const detailDelayValue = vehicleDetail.delay ?? 0;
            const shouldUpdateDelay = !isFallback && (detailDelayValue !== 0 || currentDelay === 0);
            const delayChanged = shouldUpdateDelay && currentDelay !== detailDelayValue;

            const sequenceChanged = !isFallback && vehicleDetail.last_stop_sequence !== undefined && selectedVehicle.last_stop_sequence !== vehicleDetail.last_stop_sequence;

            const routeInfoChanged =
                (vehicleDetail.route_short_name !== undefined && selectedVehicle.route_short_name !== vehicleDetail.route_short_name) ||
                (vehicleDetail.route_type !== undefined && selectedVehicle.route_type !== vehicleDetail.route_type) ||
                (vehicleDetail.trip_headsign !== undefined && selectedVehicle.trip_headsign !== vehicleDetail.trip_headsign);

            if (coordsChanged || delayChanged || bearingChanged || sequenceChanged || tripIdChanged || routeInfoChanged) {
                updated = true;
                if (hasValidDetailLocation || (newCoords[0] === 0 && newCoords[1] === 0)) {
                    if (detailCoords) {
                        newCoords = detailCoords;
                    }
                }

                newProps = {
                    ...newProps,
                    gtfs_trip_id: vehicleDetail.gtfs_trip_id || newProps.gtfs_trip_id,
                    delay: shouldUpdateDelay ? detailDelayValue : currentDelay,
                    bearing: isFallback ? (tripIdChanged ? null : (newProps.bearing ?? selectedVehicle.bearing)) : (vehicleDetail.bearing ?? newProps.bearing),
                    state_position: isFallback ? (tripIdChanged ? 'on_track' : (newProps.state_position ?? selectedVehicle.state_position)) : (vehicleDetail.state_position || newProps.state_position),
                    last_stop_sequence: isFallback ? (tripIdChanged ? null : (newProps.last_stop_sequence ?? selectedVehicle.last_stop_sequence)) : (vehicleDetail.last_stop_sequence ?? (tripIdChanged ? null : newProps.last_stop_sequence)),
                    origin_timestamp: isFallback ? (tripIdChanged ? undefined : (newProps.origin_timestamp ?? selectedVehicle.origin_timestamp)) : (vehicleDetail.origin_timestamp || newProps.origin_timestamp),
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

        if (updated) {
            setSelectedVehicle((prev: VehicleDetail | null) => {
                if (!prev) {
                    return null;
                }
                const prevCoords = prev.geometry?.coordinates || [0, 0];
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

                return { ...prev, ...newProps, geometry: { type: 'Point', coordinates: newCoords } } as VehicleDetail;
            });
        }

        // Camera move on first valid location
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
    }, [rawVehicles, vehicleDetail, selectedId, selectedVehicle, setSelectedVehicle, mapRef]);

    // --- 5. CAMERA FOLLOW ---
    useEffect(() => {
        if (!mapRef.current) {
            return;
        }

        const isMobile = typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false;
        const padding = isMobile
            ? { bottom: window.innerHeight / MOBILE_BOTTOM_SHEET_RATIO, top: 0, left: 0, right: 0 }
            : { bottom: 0, top: 0, left: SIDEBAR_WIDTH, right: 0 };

        if (!isFollowing) {
            if (selectedStop?.coordinates) {
                const [lng, lat] = selectedStop.coordinates;
                mapRef.current.easeTo({
                    center: [lng, lat],
                    zoom: Math.max(mapRef.current.getZoom(), 14),
                    duration: 1000,
                    padding
                });
            }
            return;
        }

        const coords = selectedVehicle?.geometry?.coordinates;
        if (!coords || (coords[0] === 0 && coords[1] === 0)) {
            return;
        }

        mapRef.current.easeTo({
            center: coords as [number, number],
            duration: 1000,
            essential: true,
            padding
        });
    }, [selectedVehicle?.geometry?.coordinates, isFollowing, mapRef, selectedStop?.coordinates]);

    // --- 6. PULSE ANIMATION ---
    useEffect(() => {
        let frame: number;
        const currentMapRef = mapRef.current;

        const animate = () => {
            const map = mapRef.current?.getMap();
            const coords = selectedVehicle?.geometry?.coordinates;
            if (map && coords && (coords[0] !== 0 || coords[1] !== 0)) {
                const time = Date.now() / 350;
                const radius = 20 + Math.sin(time) * 15;
                const opacity = 0.6 - ((radius - 5) / 50);

                try {
                    if (map.getLayer('selected-vehicle-pulse')) {
                        map.setPaintProperty('selected-vehicle-pulse', 'circle-radius', radius);
                        map.setPaintProperty('selected-vehicle-pulse', 'circle-opacity', Math.max(0.1, opacity));
                    }
                } catch {
                    /* Layer not ready */
                }
            }
            frame = requestAnimationFrame(animate);
        };

        if (selectedVehicle) {
            frame = requestAnimationFrame(animate);
        }

        return () => {
            if (frame) {
                cancelAnimationFrame(frame);
            }
            const map = currentMapRef?.getMap();
            if (map && map.getLayer('selected-vehicle-pulse')) {
                try {
                    map.setPaintProperty('selected-vehicle-pulse', 'circle-radius', 0);
                    map.setPaintProperty('selected-vehicle-pulse', 'circle-opacity', 0);
                } catch {
                    /* Fail silently */
                }
            }
        };
    }, [selectedVehicle, mapRef]);
};
