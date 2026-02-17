
import { useCallback, useEffect } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { MapRef } from 'react-map-gl/maplibre';
import {
    MOBILE_BREAKPOINT,
    MAP_MOVE_DURATION_MS,
    SIDEBAR_WIDTH,
    MAP_FLY_DURATION_MS
} from '../config/constants';
import { API_ENDPOINTS } from '../config/api';
import type { TrackedVehicle } from '../types/transit';

/**
 * Hook to manage complex map interactions like auto-following vehicles and manual selection from the departure board.
 * Includes logic for smooth camera movement and pre-fetching vehicle details.
 *
 * @param mapRef - React ref to the MapLibre instance.
 * @param selectedVehicle - The vehicle currently being tracked.
 * @param isFollowing - Boolean indicating if auto-follow is active.
 * @param setIsFollowing - Setter for follow state.
 * @param setSelectedVehicle - Setter for vehicle selection.
 * @param queryClient - TanStack Query client for manual cache manipulation.
 * @returns Interaction handlers (onDragStart, handleDepartureClick).
 */
export const useMapInteraction = (
    mapRef: React.RefObject<MapRef | null>,
    selectedVehicle: TrackedVehicle | null,
    isFollowing: boolean,
    setIsFollowing: (val: boolean | ((prev: boolean) => boolean)) => void,
    setSelectedVehicle: (v: TrackedVehicle | null | ((prev: TrackedVehicle | null) => TrackedVehicle | null)) => void,
    queryClient: QueryClient
) => {
    // Auto-following logic: Smooth map movement when vehicle moves
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

    const onDragStart = useCallback(() => {
        if (isFollowing) {
            console.log('👆 Drag detected, disabling auto-follow');
            setIsFollowing(false);
        }
    }, [isFollowing, setIsFollowing]);

    const handleDepartureClick = useCallback(async (tripId: string, vehicleId?: string, initialData?: {
        line?: string;
        type?: string | number;
        headsign?: string;
        delay?: number;
    }) => {
        const activeVehId = vehicleId || `trip-${tripId}`;

        // Initialize with placeholder coords - map won't move until isFollowing is true
        setSelectedVehicle({
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
        });

        try {
            const res = await fetch(`${API_ENDPOINTS.VEHICLE_DETAIL}?tripId=${encodeURIComponent(tripId)}&vehicleId=${encodeURIComponent(activeVehId)}`);
            if (res.ok) {
                const data = await res.json();

                // Set data to cache to avoid refetch in useVehicleDetail
                queryClient.setQueryData(['vehicle-detail', activeVehId, tripId], data);

                if (data.geometry?.coordinates) {
                    const coords = data.geometry.coordinates;
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { shapes, stop_times, ...liteData } = data;

                    setSelectedVehicle((prev) => prev ? { ...prev, _geometry: coords, ...liteData } : null);

                    setIsFollowing(true);

                    const isMobile = typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false;
                    mapRef.current?.flyTo({
                        center: coords,
                        zoom: 15,
                        duration: MAP_FLY_DURATION_MS,
                        essential: true,
                        padding: isMobile
                            ? { bottom: window.innerHeight / 2.2, top: 0, left: 0, right: 0 }
                            : { bottom: 0, top: 0, left: SIDEBAR_WIDTH + 30, right: 0 }
                    });
                }
            }
        } catch (err) {
            console.error('Prefetch failed:', err);
        }
    }, [mapRef, queryClient, setSelectedVehicle, setIsFollowing]);

    return {
        onDragStart,
        handleDepartureClick
    };
};
