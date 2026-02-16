
import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useVehicles } from './useVehicles';
import { useVehicleDetail } from './useVehicleDetail';
import { useStops } from './useStops';
import { useDepartures } from './useDepartures';
import { useGeolocation } from './useGeolocation';
import { useGroupedDepartures } from './useGroupedDepartures';
import { useRouteShape } from './useRouteShape';
import { useMapAnimation } from './useMapAnimation';
import { useMapCentroids } from './useMapCentroids';
import { useMapUrlSync } from './useMapUrlSync';
import { useMapVehicleSync } from './useMapVehicleSync';
import { addAllIcons } from '../utils/mapIcons';
import type { MapRef } from 'react-map-gl/maplibre';
import type { VehicleFeature, VehicleCollection, TrackedVehicle } from '../types/transit';

const EMPTY_GEOJSON: VehicleCollection = {
    type: 'FeatureCollection',
    features: []
};

export const useMapLogic = (mapRef: React.RefObject<MapRef | null>) => {
    const queryClient = useQueryClient();
    const [mapLoaded, setMapLoaded] = useState(false);
    const [bounds, setBounds] = useState<string | null>(null);
    const [debouncedBounds, setDebouncedBounds] = useState<string | null>(null);
    const [selectedStop, setSelectedStop] = useState<{ id: string; name: string } | null>(null);
    const [selectedVehicle, setSelectedVehicle] = useState<TrackedVehicle | null>(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [showVehicles, setShowVehicles] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('showVehicles');
            return saved !== null ? saved === 'true' : true;
        }
        return true;
    });
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
    const [departureSort, setDepartureSort] = useState<'line' | 'departure'>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('departureSort');
            return (saved === 'line' || saved === 'departure') ? saved : 'line';
        }
        return 'line';
    });
    const [routeFilter, setRouteFilter] = useState<string[] | null>(null);
    const [labelLayerId, setLabelLayerId] = useState<string | undefined>(undefined);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Identify the trip ID of the vehicle we are tracking (if any)
    const trackedId = useMemo(() => {
        if (!selectedVehicle) return null;
        return selectedVehicle.gtfs_trip_id || selectedVehicle.trip_id || null;
    }, [selectedVehicle]);

    const { data: rawVehicles, isFetching: fetchingVehicles, dataUpdatedAt } = useVehicles(debouncedBounds, trackedId, routeFilter);
    const { data: vehicleDetail, isFetching: loadingDetail } = useVehicleDetail(
        selectedVehicle?.vehicle_id || selectedVehicle?.id || null,
        selectedVehicle?.gtfs_trip_id || selectedVehicle?.trip_id || null
    );
    const { data: stops } = useStops();
    const { data: departures, isLoading: loadingDeps } = useDepartures(selectedStop?.id || null);

    const selectedId = useMemo(() => selectedVehicle?.vehicle_id || selectedVehicle?.id || null, [selectedVehicle]);

    // 2. Modular Hook Orchestration
    const { userLocation, handleLocate, performGeolocation } = useGeolocation(mapRef);
    useMapUrlSync(selectedStop, setSelectedStop);
    useMapAnimation(mapRef, selectedVehicle, isFollowing);
    useMapVehicleSync(selectedId, selectedVehicle, setSelectedVehicle, isFollowing, rawVehicles as VehicleCollection, vehicleDetail);

    // 3. Derived State
    const groupedDepartures = useGroupedDepartures(departures, departureSort);
    const routeShapeData = useRouteShape(selectedVehicle, vehicleDetail);

    const displayVehicles = useMemo((): VehicleCollection => {
        if (!rawVehicles?.features) return EMPTY_GEOJSON;
        return rawVehicles as VehicleCollection;
    }, [rawVehicles]);

    const selectedVehicleFeature = useMemo((): VehicleCollection => {
        if (!selectedVehicle || !selectedVehicle._geometry) return EMPTY_GEOJSON;

        return {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: selectedVehicle._geometry
                    },
                    properties: {
                        ...selectedVehicle,
                        route_type: selectedVehicle.route_type,
                        gtfs_route_short_name: selectedVehicle.gtfs_route_short_name || selectedVehicle.route_short_name
                    }
                } as VehicleFeature
            ]
        };
    }, [selectedVehicle]);

    // Split data: platforms (no centroids) and labels (only centroids)
    const stopsData = useMemo(() => {
        if (!stops) return null;
        return {
            type: 'FeatureCollection',
            features: stops.features.filter(f => !f.properties.is_centroid)
        } as typeof stops;
    }, [stops]);

    const labelData = useMapCentroids(stops || null);

    // Auto-following logic: Smooth map movement
    useEffect(() => {
        if (!isFollowing || !selectedVehicle?._geometry || !mapRef.current) return;

        const [lng, lat] = selectedVehicle._geometry;
        const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

        mapRef.current.easeTo({
            center: [lng, lat],
            duration: 1000,
            essential: true,
            padding: isMobile
                ? { bottom: window.innerHeight / 2.2, top: 0, left: 0, right: 0 }
                : { bottom: 0, top: 0, left: 450, right: 0 }
        });
    }, [selectedVehicle?._geometry, isFollowing, mapRef]);

    const getRoundedBounds = (map: any) => {
        const b = map.getBounds();
        const zoom = map.getZoom();
        const round = (num: number) => Math.round(num * 1000) / 1000;
        return b && zoom >= 11
            ? `${round(b.getSouth())},${round(b.getWest())},${round(b.getNorth())},${round(b.getEast())}`
            : null;
    };

    const onMove = useCallback((evt: any) => {
        if (isFollowing) return;

        const { zoom } = evt.viewState;
        if (!evt.originalEvent) return;

        const currentBounds = getRoundedBounds(evt.target);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setDebouncedBounds(currentBounds);
            setBounds(currentBounds);
        }, 800);

        if (zoom < 11 && bounds !== null) {
            setBounds(null);
        }
    }, [bounds, isFollowing]);

    const onMoveEnd = useCallback((evt: any) => {
        if (isFollowing) return;

        const { latitude, longitude, zoom } = evt.viewState;
        const currentBounds = getRoundedBounds(evt.target);

        const url = new URL(window.location.href);
        url.searchParams.set('lat', latitude.toFixed(5));
        url.searchParams.set('lng', longitude.toFixed(5));
        url.searchParams.set('z', zoom.toFixed(2));
        window.history.replaceState({}, '', url.toString());

        if (evt.originalEvent) {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            setBounds(currentBounds);
            setDebouncedBounds(currentBounds);
        }
    }, [isFollowing]);

    const onDragStart = useCallback(() => {
        if (isFollowing) {
            console.log('👆 Drag detected, disabling auto-follow');
            setIsFollowing(false);
        }
    }, [isFollowing]);

    const handleDepartureClick = useCallback(async (tripId: string, vehicleId?: string, initialData?: any) => {
        const activeVehId = vehicleId || `trip-${tripId}`;

        // Initialize with 0,0 coords - map won't move until isFollowing is true
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
        // Do NOT set isFollowing(true) here - wait for real coords

        try {
            const res = await fetch(`/api/vehicle-detail?tripId=${encodeURIComponent(tripId)}&vehicleId=${encodeURIComponent(activeVehId)}`);
            if (res.ok) {
                const data = await res.json();

                // Set data to cache to avoid refetch in useVehicleDetail
                queryClient.setQueryData(['vehicle-detail', activeVehId, tripId], data);

                if (data.geometry?.coordinates) {
                    const coords = data.geometry.coordinates;
                    const { shapes, stop_times, ...liteData } = data;
                    setSelectedVehicle((prev: any) => prev ? { ...prev, _geometry: coords, ...liteData } : null);

                    setIsFollowing(true);

                    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
                    mapRef.current?.flyTo({
                        center: coords,
                        zoom: 15,
                        duration: 1500,
                        essential: true,
                        padding: isMobile
                            ? { bottom: window.innerHeight / 2.2, top: 0, left: 0, right: 0 }
                            : { bottom: 0, top: 0, left: 450, right: 0 }
                    });
                }
            }
        } catch (err) {
            console.error('Prefetch failed:', err);
        }
    }, [mapRef]);

    // Persist settings
    useEffect(() => {
        localStorage.setItem('showVehicles', String(showVehicles));
    }, [showVehicles]);

    useEffect(() => {
        localStorage.setItem('departureSort', departureSort);
    }, [departureSort]);

    const onLoad = useCallback((evt: any) => {
        const map = evt.target;
        const layers = map.getStyle().layers;
        if (layers) {
            const firstLabelLayer = layers.find((layer: any) => layer.type === 'symbol' && layer.layout?.['text-field']);
            if (firstLabelLayer) {
                setLabelLayerId(firstLabelLayer.id);
            }
        }
        addAllIcons(map);
        setMapLoaded(true);

        const b = map.getBounds();
        const z = map.getZoom();
        if (b && z >= 11) {
            const round = (num: number) => Math.round(num * 1000) / 1000;
            const initialBounds = `${round(b.getSouth())},${round(b.getWest())},${round(b.getNorth())},${round(b.getEast())}`;
            setBounds(initialBounds);
            setDebouncedBounds(initialBounds);
        }

        performGeolocation(false);
    }, [performGeolocation]);

    const toggleGroup = useCallback((groupId: string) => {
        setExpandedGroups(prev => prev.includes(groupId) ? prev.filter(g => g !== groupId) : [...prev, groupId]);
    }, []);

    return useMemo(() => ({
        bounds, debouncedBounds, selectedStop, selectedVehicle, userLocation, isFollowing,
        showVehicles, isSettingsOpen, expandedGroups, departureSort, routeFilter,
        setSelectedStop, setSelectedVehicle, setIsFollowing, setShowVehicles, setIsSettingsOpen,
        setDepartureSort, handleLocate, onMove, onMoveEnd, onLoad, onDragStart, handleDepartureClick, toggleGroup, setExpandedGroups,
        setRouteFilter, displayVehicles, selectedVehicleFeature, vehicleDetail, loadingDetail, stopsData, labelData, groupedDepartures,
        stops, loadingDeps, routeShapeData, fetchingVehicles, dataUpdatedAt, mapLoaded, selectedId, labelLayerId
    }), [
        bounds, debouncedBounds, selectedStop, selectedVehicle, userLocation, isFollowing,
        showVehicles, isSettingsOpen, expandedGroups, departureSort, routeFilter,
        handleLocate, onMove, onMoveEnd, onLoad, onDragStart, handleDepartureClick,
        displayVehicles, selectedVehicleFeature, vehicleDetail, loadingDetail, stopsData, labelData, groupedDepartures,
        stops, loadingDeps, routeShapeData, fetchingVehicles, dataUpdatedAt, mapLoaded, selectedId, labelLayerId
    ]);
};
