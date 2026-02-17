
import { useCallback, useEffect } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { MapRef } from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent, MapGeoJSONFeature } from 'maplibre-gl';
import type { Point } from 'geojson';
import {
    MOBILE_BREAKPOINT,
    MAP_MOVE_DURATION_MS,
    SIDEBAR_WIDTH,
    MAP_FLY_DURATION_MS
} from '../config/constants';
import { API_ENDPOINTS } from '../config/api';
import type { TrackedVehicle } from '../types/transit';
import type { MapAction } from './useMapReducer';

/**
 * Controller hook that manages map interactions, clicks, and camera movements.
 * Consolidates click handling and auto-follow logic.
 */
export const useMapController = (
    mapRef: React.RefObject<MapRef | null>,
    dispatch: React.Dispatch<MapAction>,
    selectedVehicle: TrackedVehicle | null,
    isFollowing: boolean,
    queryClient: QueryClient
) => {
    // 1. Auto-following logic: Smooth map movement when vehicle moves
    useEffect(() => {
        if (!isFollowing || !selectedVehicle?._geometry || !mapRef.current) return;

        const [lng, lat] = selectedVehicle._geometry;
        const isMobile = typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false;

        mapRef.current.easeTo({
            center: [lng, lat],
            duration: MAP_MOVE_DURATION_MS,
            essential: true,
            padding: isMobile
                ? { bottom: window.innerHeight / 2.2, top: 0, left: 0, right: 0 }
                : { bottom: 0, top: 0, left: SIDEBAR_WIDTH + 30, right: 0 }
        });
    }, [selectedVehicle?._geometry, isFollowing, mapRef]);

    // 2. Map Click Handler (Combined from useMapClickHandlers)
    const onMapClick = useCallback((evt: MapLayerMouseEvent) => {
        const features = evt.features as MapGeoJSONFeature[] | undefined;
        const f = features?.[0];
        if (!f || f.layer.id === 'entrance-layer') return;

        // Handle Clusters
        if (f.layer.id === 'clusters') {
            const clusterId = f.properties?.cluster_id;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const source = mapRef.current?.getMap().getSource('pid-stops') as any;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            source?.getClusterExpansionZoom(clusterId, (err: any, zoom: any) => {
                if (err || !zoom) return;
                mapRef.current?.easeTo({
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    center: (f.geometry as any).coordinates as [number, number],
                    zoom,
                    duration: 500
                });
            });
            return;
        }

        // Handle Vehicles
        if (['vehicles-point', 'vehicles-direction-fg', 'vehicles-label'].includes(f.layer.id)) {
            const props = f.properties;
            dispatch({
                type: 'SET_VEHICLE',
                vehicle: {
                    ...props,
                    vehicle_id: String(props?.vehicle_id || props?.id),
                    _geometry: (f.geometry as Point).coordinates as [number, number]
                } as TrackedVehicle
            });
            return;
        }

        // Handle Stops
        if (['unclustered-point', 'transfer-stations'].includes(f.layer.id)) {
            const props = f.properties;
            const pc = props?.platform_code;
            const name = (pc && pc.trim().length > 0) ? `${props?.stop_name} (${pc})` : props?.stop_name;
            dispatch({
                type: 'SET_STOP',
                stop: { id: props?.stop_id, name }
            });
        }
    }, [mapRef, dispatch]);

    const onDragStart = useCallback(() => {
        if (isFollowing) {
            dispatch({ type: 'SET_FOLLOWING', following: false });
        }
    }, [isFollowing, dispatch]);

    const handleDepartureClick = useCallback(async (tripId: string, vehicleId?: string, initialData?: {
        line?: string;
        type?: string | number;
        headsign?: string;
        delay?: number;
    }) => {
        const activeVehId = vehicleId || `trip-${tripId}`;

        dispatch({
            type: 'SET_VEHICLE',
            vehicle: {
                vehicle_id: activeVehId,
                gtfs_trip_id: tripId,
                trip_id: tripId,
                gtfs_route_short_name: initialData?.line,
                route_type: initialData?.type,
                gtfs_trip_headsign: initialData?.headsign,
                delay: initialData?.delay || 0,
                state_position: 'on_track',
                _geometry: [0, 0],
                bearing: null
            },
            follow: false
        });

        try {
            const res = await fetch(`${API_ENDPOINTS.VEHICLE_DETAIL}?tripId=${encodeURIComponent(tripId)}&vehicleId=${encodeURIComponent(activeVehId)}`);
            if (res.ok) {
                const data = await res.json();
                queryClient.setQueryData(['vehicle-detail', activeVehId, tripId], data);

                if (data.geometry?.coordinates) {
                    const coords = data.geometry.coordinates;
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { shapes, stop_times, ...liteData } = data;

                    dispatch({
                        type: 'UPDATE_SELECTED_VEHICLE',
                        vehicle: { ...liteData, vehicle_id: activeVehId, _geometry: coords } as TrackedVehicle
                    });
                    dispatch({ type: 'SET_FOLLOWING', following: true });

                    const isMobile = typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false;
                    mapRef.current?.flyTo({
                        center: coords,
                        zoom: 15,
                        duration: MAP_FLY_DURATION_MS,
                        padding: isMobile
                            ? { bottom: window.innerHeight / 2.2, top: 0, left: 0, right: 0 }
                            : { bottom: 0, top: 0, left: SIDEBAR_WIDTH + 30, right: 0 }
                    });
                }
            }
        } catch (err) {
            console.error('Prefetch failed:', err);
        }
    }, [mapRef, queryClient, dispatch]);

    return {
        onMapClick,
        onDragStart,
        handleDepartureClick
    };
};
