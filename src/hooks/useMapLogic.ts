
import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useVehicles } from './useVehicles';
import { useVehicleDetail } from './useVehicleDetail';
import { useStops } from './useStops';
import { useDepartures } from './useDepartures';
import { useGeolocation } from './useGeolocation';
import { useGroupedDepartures } from './useGroupedDepartures';
import { useRouteShape } from './useRouteShape';
import { addAllIcons } from '../utils/mapIcons';
import type { MapRef } from 'react-map-gl/maplibre';

const EMPTY_GEOJSON: any = {
    type: 'FeatureCollection',
    features: []
};

export const useMapLogic = (mapRef: React.RefObject<MapRef | null>) => {
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
    const [labelLayerId, setLabelLayerId] = useState<string | undefined>(undefined);
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

    const selectedId = useMemo(() => selectedVehicle?.vehicle_id || selectedVehicle?.id, [selectedVehicle?.vehicle_id, selectedVehicle?.id]);



    const displayVehicles = useMemo(() => {
        if (!rawVehicles?.features) return EMPTY_GEOJSON;
        // DIRECT PASS-THROUGH: No modification means no source reload on click!
        return rawVehicles;
    }, [rawVehicles]);

    const selectedVehicleFeature = useMemo(() => {
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
                        // Normalized properties for styling
                        route_type: selectedVehicle.route_type || selectedVehicle.t,
                        gtfs_route_short_name: selectedVehicle.gtfs_route_short_name || selectedVehicle.route_short_name || selectedVehicle.n
                    }
                }
            ]
        };
    }, [selectedVehicle, selectedVehicle?._geometry]);

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


    // Pulsing animation for selected vehicle
    useEffect(() => {
        let frame: number;
        const animate = () => {
            const map = mapRef.current?.getMap();
            if (map && selectedVehicle && isFollowing) {
                const time = Date.now() / 350;
                const radius = 20 + Math.sin(time) * 15; // Base 20, pulse +/- 15
                const opacity = 0.6 - ((radius - 5) / 50); // Fade out as it expands

                try {
                    if (map.getLayer('selected-vehicle-pulse')) {
                        map.setPaintProperty('selected-vehicle-pulse', 'circle-radius', radius);
                        map.setPaintProperty('selected-vehicle-pulse', 'circle-opacity', Math.max(0.1, opacity));
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
            if (map && map.getLayer('selected-vehicle-pulse')) {
                try {
                    map.setPaintProperty('selected-vehicle-pulse', 'circle-radius', 0);
                    map.setPaintProperty('selected-vehicle-pulse', 'circle-opacity', 0);
                } catch (e) {
                    // Silently fail
                }
            }
        };
    }, [selectedVehicle, isFollowing, mapRef]);

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

        // Update state with same rounded bounds to prevent double-fetch discrepancy
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

    const handleDepartureClick = async (tripId: string, vehicleId?: string, initialData?: any) => {
        console.log('🚋 Departure click. Prefetching coords for instant flyTo...');
        const activeVehId = vehicleId || `trip-${tripId}`;

        setSelectedStop(null);
        setSelectedVehicle({
            vehicle_id: activeVehId,
            gtfs_trip_id: tripId,
            trip_id: tripId,
            gtfs_route_short_name: initialData?.line,
            route_type: initialData?.type,
            gtfs_trip_headsign: initialData?.headsign,
            delay: initialData?.delay || 0,
            state_position: 'on_track',
            _geometry: [14.4378, 50.0755]
        });
        setIsFollowing(true);

        // IMMEDIATE PREFETCH for flyTo coordinates
        try {
            const res = await fetch(`/api/vehicle-detail?tripId=${encodeURIComponent(tripId)}&vehicleId=${encodeURIComponent(activeVehId)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.geometry?.coordinates) {
                    const coords = data.geometry.coordinates;
                    console.log('📍 Got coordinates, flying immediately:', coords);

                    // PRUNE massive data before putting into state to keep it snappy
                    const { shapes, stop_times, ...liteData } = data;
                    setSelectedVehicle((prev: any) => prev ? { ...prev, _geometry: coords, ...liteData } : null);

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
    };

    // SYNC MOTOR: Keeps selectedVehicle in sync with live data
    useEffect(() => {
        if (!selectedId || !isFollowing) return;

        const sid = String(selectedId);
        const stid = String(selectedVehicle?.gtfs_trip_id || selectedVehicle?.trip_id || 'NONE');

        let updated = false;
        let newProps = {};
        let newCoords = selectedVehicle?._geometry;

        // 1. Sync from Map Stream
        if (rawVehicles?.features) {
            const match = (rawVehicles.features as any[]).find(f => {
                const fid = String(f.properties.vehicle_id || f.properties.id || '');
                const ftid = String(f.properties.gtfs_trip_id || f.properties.trip_id || '');
                if (sid !== 'NONE' && !sid.startsWith('trip-')) return fid === sid;
                return ftid === stid && stid !== 'NONE';
            });

            if (match) {
                const p = match.properties;
                const coords = match.geometry.coordinates;
                const matchId = String(p.vehicle_id || p.id);

                if (selectedVehicle?._geometry?.[0] !== coords[0] || selectedVehicle?.delay !== p.delay) {
                    updated = true;
                    newProps = { ...p, vehicle_id: sid.startsWith('trip-') ? matchId : sid };
                    newCoords = coords;
                }
            }
        }

        // 2. Sync from Direct Detail API (Robust Extraction)
        const det = vehicleDetail as any;
        let detailCoords: number[] | null = null;
        let detailBearing: number | null = null;

        if (det) {
            // Case A: Direct Feature object
            if (det.geometry?.coordinates) {
                detailCoords = det.geometry.coordinates;
            }
            // Case B: FeatureCollection (some endpoints wrap it)
            else if (det.features?.[0]?.geometry?.coordinates) {
                detailCoords = det.features[0].geometry.coordinates;
                // Also grab properties if nested
                if (det.features[0].properties) {
                    newProps = { ...newProps, ...det.features[0].properties };
                }
            }

            // Extract bearing if available
            if (det.properties?.bearing || det.properties?.b) detailBearing = det.properties.bearing || det.properties.b;
            else if (det.bearing || det.b) detailBearing = det.bearing || det.b;
        }

        if (detailCoords) {
            if (!newCoords || newCoords[0] !== detailCoords[0] || newCoords[1] !== detailCoords[1]) {
                updated = true;
                newCoords = detailCoords;
            }
            // Also sync bearing if available from detail
            if (detailBearing !== null && detailBearing !== undefined) {
                // Ensure bearing update triggers refresh
                if ((newProps as any).bearing !== detailBearing) {
                    updated = true;
                    newProps = { ...newProps, bearing: detailBearing };
                }
            }
        }

        if (updated) {
            setSelectedVehicle((prev: any) => prev ? { ...prev, ...newProps, _geometry: newCoords } : null);
        }
    }, [rawVehicles, vehicleDetail, isFollowing, selectedId]);

    // Persist settings
    useEffect(() => {
        localStorage.setItem('showVehicles', String(showVehicles));
    }, [showVehicles]);

    useEffect(() => {
        localStorage.setItem('departureSort', departureSort);
    }, [departureSort]);

    const onLoad = useCallback((evt: any) => {
        const map = evt.target;

        // Smart Layer Placement: Find the first symbol/label layer to put route underneath
        const layers = map.getStyle().layers;
        if (layers) {
            const firstLabelLayer = layers.find((layer: any) => layer.type === 'symbol' && layer.layout?.['text-field']);
            if (firstLabelLayer) {
                setLabelLayerId(firstLabelLayer.id);
            }
        }

        // Add all custom icons to the map style
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

        // Auto-locate if no params in URL
        const p = new URLSearchParams(window.location.search);
        if (!p.has('lat') && !p.has('lng') && !p.has('z') && !p.has('stopId') && !p.has('tripId')) {
            performGeolocation(false);
        }
    }, [performGeolocation]);

    // ... (rest of code)
    const stopsData = useMemo(() => {
        if (!stops) return null;
        return { type: 'FeatureCollection' as const, features: (stops as any).features };
    }, [stops]);

    const labelData = useMemo(() => {
        if (!stopsData) return null;

        const groups: Record<string, any[]> = {};
        stopsData.features.forEach((f: any) => {
            if (f.properties.location_type === 2) return; // Skip entrances
            const name = f.properties.stop_name;
            if (!groups[name]) groups[name] = [];
            groups[name].push(f);
        });

        const labelFeatures = Object.entries(groups).map(([_name, features]) => {
            // Prefer location_type 1 (Station) if explicitly available in the data
            const stationSource = features.find(f => f.properties.location_type === 1);
            if (stationSource) return stationSource;

            // Otherwise calculate the geographic centroid (average position)
            let sumLng = 0;
            let sumLat = 0;
            features.forEach(f => {
                sumLng += f.geometry.coordinates[0];
                sumLat += f.geometry.coordinates[1];
            });
            const avgLng = sumLng / features.length;
            const avgLat = sumLat / features.length;

            return {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [avgLng, avgLat]
                },
                properties: {
                    ...features[0].properties,
                    is_centroid: true
                }
            };
        });

        return {
            type: 'FeatureCollection',
            features: labelFeatures
        } as any;
    }, [stopsData]);

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev => prev.includes(groupId) ? prev.filter(g => g !== groupId) : [...prev, groupId]);
    };

    return useMemo(() => ({
        bounds, debouncedBounds, selectedStop, selectedVehicle, userLocation, isFollowing,
        showVehicles, isSettingsOpen, expandedGroups, departureSort,
        setSelectedStop, setSelectedVehicle, setIsFollowing, setShowVehicles, setIsSettingsOpen,
        setDepartureSort, handleLocate, onMove, onMoveEnd, onLoad, onDragStart, handleDepartureClick, toggleGroup, setExpandedGroups,
        displayVehicles, selectedVehicleFeature, vehicleDetail, loadingDetail, stopsData, labelData, groupedDepartures,
        stops, loadingDeps, routeShapeData, fetchingVehicles, dataUpdatedAt, mapLoaded, selectedId, labelLayerId
    }), [
        bounds, debouncedBounds, selectedStop, selectedVehicle, userLocation, isFollowing,
        showVehicles, isSettingsOpen, expandedGroups, departureSort,
        setSelectedStop, setSelectedVehicle, setIsFollowing, setShowVehicles, setIsSettingsOpen,
        setDepartureSort, handleLocate, onMove, onMoveEnd, onLoad, onDragStart, handleDepartureClick, toggleGroup, setExpandedGroups,
        displayVehicles, selectedVehicleFeature, vehicleDetail, loadingDetail, stopsData, labelData, groupedDepartures,
        stops, loadingDeps, routeShapeData, fetchingVehicles, dataUpdatedAt, mapLoaded, selectedId, labelLayerId
    ]);
};
