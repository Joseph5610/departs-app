
import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useVehicles } from './useVehicles';
import { useVehicleDetail } from './useVehicleDetail';
import { useStops } from './useStops';
import { useDepartures } from './useDepartures';
import { useGeolocation } from './useGeolocation';
import { useGroupedDepartures } from './useGroupedDepartures';
import { useRouteShape } from './useRouteShape';
import { useToast } from '../components/Toast';
import { addAllIcons } from '../utils/mapIcons';
import type { MapRef } from 'react-map-gl/maplibre';
import { useTranslation } from 'react-i18next';

export const useMapLogic = (mapRef: React.RefObject<MapRef | null>) => {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [mapLoaded, setMapLoaded] = useState(false);
    const [bounds, setBounds] = useState<string | null>(null);
    const [debouncedBounds, setDebouncedBounds] = useState<string | null>(null);
    const [selectedStop, setSelectedStop] = useState<{ id: string; name: string } | null>(null);
    const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
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
    const debounceRef = useRef<any>(null);

    // Use extracted hooks
    const { userLocation, performGeolocation, handleLocate } = useGeolocation(mapRef);

    // Identify the trip ID of the vehicle we are tracking (if any)
    const trackedId = useMemo(() => {
        if (!isFollowing || !selectedVehicle) return null;
        return selectedVehicle.gtfs_trip_id || selectedVehicle.trip_id || selectedVehicle.tId || null;
    }, [isFollowing, selectedVehicle]);

    const { data: rawVehicles, isFetching: fetchingVehicles, dataUpdatedAt } = useVehicles(debouncedBounds, trackedId);
    const { data: vehicleDetail, isFetching: loadingDetail } = useVehicleDetail(
        selectedVehicle?.vehicle_id || selectedVehicle?.id,
        selectedVehicle?.gtfs_trip_id || selectedVehicle?.trip_id || selectedVehicle?.tId
    );
    const { data: stops } = useStops();
    const { data: departures, isLoading: loadingDeps } = useDepartures(selectedStop?.id || null);

    const groupedDepartures = useGroupedDepartures(departures, departureSort);
    const routeShapeData = useRouteShape(selectedVehicle, vehicleDetail);

    // Sync selectedStop with URL
    useEffect(() => {
        const p = new URLSearchParams(window.location.search);
        const id = p.get('stopId');
        const name = p.get('stopName');
        if (id && name && !selectedStop) {
            setSelectedStop({ id, name });
        }
    }, []);

    useEffect(() => {
        const url = new URL(window.location.href);
        if (selectedStop) {
            url.searchParams.set('stopId', selectedStop.id);
            url.searchParams.set('stopName', selectedStop.name);
        } else {
            url.searchParams.delete('stopId');
            url.searchParams.delete('stopName');
        }
        window.history.replaceState({}, '', url.toString());
    }, [selectedStop]);

    // Merge raw vehicles with selected vehicle to ensure tracked vehicle is always visible
    const displayVehicles = useMemo(() => {
        let features = rawVehicles?.features || [];

        // 1. Ensure selected vehicle is in the list
        if (selectedVehicle) {
            const exists = features.find((f: any) => {
                const fid = f.properties.vehicle_id || f.properties.id;
                const sid = selectedVehicle.vehicle_id || selectedVehicle.id;
                return fid === sid;
            });

            if (!exists) {
                features = [
                    ...features,
                    {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: selectedVehicle._geometry || [0, 0]
                        },
                        properties: selectedVehicle
                    }
                ];
            }
        }

        if (features.length === 0) return null;

        // 2. JITTERING: Detect stacks and spread them out
        // Group by coordinate key "lng,lat"
        const groups: Record<string, any[]> = {};
        features.forEach((f: any) => {
            const key = f.geometry.coordinates.join(',');
            if (!groups[key]) groups[key] = [];
            groups[key].push(f);
        });

        const jitteredFeatures: any[] = [];
        const BASE_JITTER_RADIUS = 0.00012; // Slightly increased for better visibility

        Object.values(groups).forEach(group => {
            if (group.length === 1) {
                jitteredFeatures.push(group[0]);
            } else {
                // Stack detected! Spread them in a circle
                const count = group.length;
                const angleStep = (2 * Math.PI) / count;

                group.forEach((f, index) => {
                    const [lng, lat] = f.geometry.coordinates;
                    const angle = index * angleStep;

                    // Alternating radius for large groups (> 4) to prevent overlap
                    let currentRadius = BASE_JITTER_RADIUS;
                    if (count > 4) {
                        currentRadius = index % 2 === 0 ? BASE_JITTER_RADIUS * 0.8 : BASE_JITTER_RADIUS * 1.35;
                    }

                    // Simple offset calculation
                    const newLng = lng + currentRadius * Math.cos(angle) * 1.3;
                    const newLat = lat + currentRadius * Math.sin(angle);

                    jitteredFeatures.push({
                        ...f,
                        geometry: {
                            ...f.geometry,
                            coordinates: [newLng, newLat]
                        }
                    });
                });
            }
        });

        return {
            type: 'FeatureCollection',
            features: jitteredFeatures
        } as any;
    }, [rawVehicles, selectedVehicle]);

    // Auto-following logic
    useEffect(() => {
        if (!isFollowing || !selectedVehicle || !rawVehicles || !mapRef.current) return;

        const vehicleFeature = rawVehicles.features.find(
            (f: any) => {
                const fid = f.properties.vehicle_id || f.properties.id;
                const sid = selectedVehicle.vehicle_id || selectedVehicle.id;
                return fid === sid;
            }
        );

        if (vehicleFeature) {
            const [lng, lat] = vehicleFeature.geometry.coordinates;
            const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

            mapRef.current.easeTo({
                center: [lng, lat],
                duration: 1000,
                essential: true,
                padding: isMobile
                    ? { bottom: window.innerHeight / 2.2, top: 0, left: 0, right: 0 }
                    : { bottom: 0, top: 0, left: 450, right: 0 }
            });
        }
    }, [rawVehicles, isFollowing, selectedVehicle, mapRef]);

    // Pulsing animation for selected vehicle
    useEffect(() => {
        let frame: number;
        const animate = () => {
            const map = mapRef.current?.getMap();
            if (map && selectedVehicle && isFollowing) {
                const time = Date.now() / 350;
                const radius = 30 + Math.sin(time) * 30;
                const opacity = 0.9 - (radius / 80);

                try {
                    if (map.getLayer('vehicles-pulse')) {
                        map.setPaintProperty('vehicles-pulse', 'circle-radius', radius);
                        map.setPaintProperty('vehicles-pulse', 'circle-opacity', Math.max(0.1, opacity));
                    }
                } catch (e) {
                    // Layer might not be ready yet
                }
            }
            frame = requestAnimationFrame(animate);
        };

        if (selectedVehicle && isFollowing) {
            frame = requestAnimationFrame(animate);
        }

        return () => {
            cancelAnimationFrame(frame);
            const map = mapRef.current?.getMap();
            if (map && map.getLayer('vehicles-pulse')) {
                try {
                    map.setPaintProperty('vehicles-pulse', 'circle-radius', 0);
                    map.setPaintProperty('vehicles-pulse', 'circle-opacity', 0);
                } catch (e) {
                    // Silently fail
                }
            }
        };
    }, [selectedVehicle, isFollowing, mapRef]);

    const onMove = useCallback((evt: any) => {
        // If we are auto-following a vehicle, do NOT update bounds based on map movement.
        // This prevents an infinite loop: Fetch -> Move Map -> Update Bounds -> Fetch -> ...
        if (isFollowing) return;

        const { zoom } = evt.viewState;
        if (!evt.originalEvent) return;

        const b = evt.target.getBounds();
        const round = (num: number) => Math.round(num * 1000) / 1000;
        const currentBounds = b && zoom >= 11
            ? `${round(b.getSouth())},${round(b.getWest())},${round(b.getNorth())},${round(b.getEast())}`
            : null;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setDebouncedBounds(currentBounds);
            setBounds(currentBounds);
        }, 1000);

        if (zoom < 11 && bounds !== null) {
            setBounds(null);
        }
    }, [bounds, isFollowing]);

    const onMoveEnd = useCallback((evt: any) => {
        if (isFollowing) return;

        const { latitude, longitude, zoom } = evt.viewState;
        const b = evt.target.getBounds();
        const currentBounds = b && zoom >= 11 ? `${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}` : null;

        const url = new URL(window.location.href);
        url.searchParams.set('lat', latitude.toFixed(5));
        url.searchParams.set('lng', longitude.toFixed(5));
        url.searchParams.set('z', zoom.toFixed(2));
        window.history.replaceState({}, '', url.toString());

        // Only update bounds (triggering a fetch) if the move was caused by user interaction
        if (evt.originalEvent) {
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

    const handleDepartureClick = async (tripId: string) => {
        console.log('🚋 Tracking vehicle with tripId:', tripId);
        let vehicleFeature: any = null;

        try {
            const res = await fetch(`/api/vehicles?tripId=${encodeURIComponent(tripId)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.features && data.features.length > 0) {
                    vehicleFeature = data.features[0];
                }
            }
        } catch (err) {
            console.error('Failed to fetch vehicle:', err);
        }

        if (!vehicleFeature) {
            showToast(t('toasts.vehicleNotFound'), 'error');
            return;
        }

        setSelectedStop(null);
        const vehicleWithGeometry = {
            ...vehicleFeature.properties,
            _geometry: vehicleFeature.geometry.coordinates
        };

        setSelectedVehicle(vehicleWithGeometry);
        setIsFollowing(true);

        const [lng, lat] = vehicleFeature.geometry.coordinates;
        const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

        mapRef.current?.flyTo({
            center: [lng, lat],
            zoom: 15,
            duration: 2000,
            essential: true,
            padding: isMobile
                ? { bottom: window.innerHeight / 2.2, top: 0, left: 0, right: 0 }
                : { bottom: 0, top: 0, left: 450, right: 0 }
        });

        // The original logic had a moveend listener here, but since the effect for auto-following
        // is reactive to selectedVehicle and rawVehicles, it should handle updates naturally.
        // We will rely on that or the existing effect that switches to "Live" vehicle data.
    };

    // Effect to upgrade selectedVehicle from "Trip-based" to "Live"
    // Persist showVehicles and departureSort to localStorage
    useEffect(() => {
        localStorage.setItem('showVehicles', String(showVehicles));
    }, [showVehicles]);

    useEffect(() => {
        localStorage.setItem('departureSort', departureSort);
    }, [departureSort]);

    useEffect(() => {
        if (!selectedVehicle || !rawVehicles || !isFollowing) return;

        const selVehId = selectedVehicle.vehicle_id || selectedVehicle.id;
        if (selVehId && String(selVehId).startsWith('trip-')) {
            const tripId = selectedVehicle.gtfs_trip_id || selectedVehicle.trip_id || selectedVehicle.tId;

            if (tripId) {
                const liveMatch = (rawVehicles.features as any[]).find(
                    f => {
                        const p = f.properties;
                        return (p.gtfs_trip_id === tripId || p.trip_id === tripId || p.tId === tripId);
                    }
                );

                if (liveMatch) {
                    const liveId = liveMatch.properties.vehicle_id || liveMatch.properties.id;
                    if (liveId && !String(liveId).startsWith('trip-')) {
                        console.log('✨ Switching to Live Vehicle Data:', liveMatch.properties);
                        setSelectedVehicle(liveMatch.properties);
                    }
                }
            }
        }
    }, [rawVehicles, selectedVehicle, isFollowing]);

    const onLoad = useCallback((evt: any) => {
        const map = evt.target;

        // Add all custom icons to the map style
        addAllIcons(map);
        setMapLoaded(true);

        const b = map.getBounds();
        const z = map.getZoom();
        if (b && z >= 11) {
            const initialBounds = `${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}`;
            setBounds(initialBounds);
            setDebouncedBounds(initialBounds);
        }

        // Auto-locate if no params in URL
        const p = new URLSearchParams(window.location.search);
        if (!p.has('lat') && !p.has('lng') && !p.has('z') && !p.has('stopId') && !p.has('tripId')) {
            performGeolocation(false);
        }
    }, [performGeolocation]);

    const stopsData = useMemo(() => {
        if (!stops) return null;
        return { type: 'FeatureCollection' as const, features: (stops as any).features };
    }, [stops]);

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev =>
            prev.includes(groupId) ? prev.filter(g => g !== groupId) : [...prev, groupId]
        );
    };

    return {
        bounds,
        debouncedBounds,
        selectedStop,
        selectedVehicle,
        userLocation,
        isFollowing,
        showVehicles,
        isSettingsOpen,
        expandedGroups,
        departureSort,
        // Setters / Actions
        setSelectedStop,
        setSelectedVehicle,
        setIsFollowing,
        setShowVehicles,
        setIsSettingsOpen,
        setDepartureSort,
        handleLocate,
        onMove,
        onMoveEnd,
        onLoad,
        onDragStart,
        handleDepartureClick,
        toggleGroup,
        setExpandedGroups,
        // Data
        displayVehicles,
        vehicleDetail,
        loadingDetail,
        stopsData,
        groupedDepartures,
        stops,
        loadingDeps,
        routeShapeData,
        fetchingVehicles,
        dataUpdatedAt,
        mapLoaded
    };
};
