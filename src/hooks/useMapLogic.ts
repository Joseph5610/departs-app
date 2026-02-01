import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useVehicles } from './useVehicles';
import { useVehicleDetail } from './useVehicleDetail';
import { useStops } from './useStops';
import { useDepartures } from './useDepartures';
import { useToast } from '../components/Toast';
import type { MapRef } from 'react-map-gl/maplibre';

export const useMapLogic = (mapRef: React.RefObject<MapRef | null>) => {
    const { showToast } = useToast();
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
    const [expandedLines, setExpandedLines] = useState<string[]>([]);
    const debounceRef = useRef<any>(null);

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
        if (!rawVehicles) {
            return selectedVehicle && selectedVehicle._geometry
                ? {
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: selectedVehicle._geometry },
                        properties: selectedVehicle
                    }]
                }
                : null;
        }

        if (!selectedVehicle) return rawVehicles;

        const exists = (rawVehicles.features as any[]).find(f => {
            const fid = f.properties.vehicle_id || f.properties.id;
            const sid = selectedVehicle.vehicle_id || selectedVehicle.id;
            return fid === sid;
        });

        if (exists) return rawVehicles;

        return {
            ...rawVehicles,
            features: [
                ...rawVehicles.features,
                {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: selectedVehicle._geometry || [0, 0]
                    },
                    properties: selectedVehicle
                }
            ]
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

    const handleLocate = () => {
        console.log('🛰️ Starting manual geolocation...');
        if (!navigator.geolocation) {
            showToast('Your browser does not support geolocation.', 'error');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                console.log('✅ Position found:', latitude, longitude);
                mapRef.current?.getMap().flyTo({
                    center: [longitude, latitude],
                    zoom: 15,
                    duration: 2000
                });
            },
            (err) => {
                console.error('Geolocation error:', err);
                showToast('Could not retrieve location. Please check browser permissions.', 'error');
            }
        );
    };

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
            showToast('Vehicle not found. It probably has not started yet.', 'error');
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
    // Persist showVehicles to localStorage
    useEffect(() => {
        localStorage.setItem('showVehicles', String(showVehicles));
    }, [showVehicles]);

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

        // Custom Bearing Arrow (SDF) - Copied from original
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, size, size);
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.moveTo(32, 12);
            ctx.lineTo(18, 46);
            ctx.lineTo(32, 38);
            ctx.lineTo(46, 46);
            ctx.closePath();
            ctx.fill();

            if (!map.hasImage('v-arrow-centered')) {
                const imageData = ctx.getImageData(0, 0, size, size);
                map.addImage('v-arrow-centered', imageData, { sdf: true });
            }
        }

        // Split Icons for Transfers - Copied from original
        const addSplitIcon = (id: string, c1: string, c2: string) => {
            const size = 64;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const cx = size / 2;
                const cy = size / 2;
                const r = size / 2 - 4;
                ctx.beginPath();
                ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
                ctx.fillStyle = 'white';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(cx, cy, r, Math.PI * 0.5, Math.PI * 1.5);
                ctx.fillStyle = c1;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(cx, cy, r, Math.PI * 1.5, Math.PI * 2.5);
                ctx.fillStyle = c2;
                ctx.fill();
                if (!map.hasImage(id)) {
                    map.addImage(id, ctx.getImageData(0, 0, size, size), { pixelRatio: 2 });
                }
            }
        };

        addSplitIcon('transfer-A-B', '#00A562', '#DEBD29');
        addSplitIcon('transfer-A-C', '#00A562', '#C6242D');
        addSplitIcon('transfer-B-C', '#DEBD29', '#C6242D');

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
            // We can't call handleLocate directly easily because it depends on mapRef which is ready here,
            // but we can inline the logic or use a timeout to ensure everything is settled.
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((pos) => {
                    const { latitude, longitude } = pos.coords;
                    map.flyTo({
                        center: [longitude, latitude],
                        zoom: 15,
                        duration: 2000
                    });
                });
            }
        }
    }, []);

    const groupedDepartures = useMemo(() => {
        if (!departures?.departures) return [];
        const groups: Record<string, any[]> = {};
        departures.departures.forEach((dep: any) => {
            const key = dep.line;
            if (!groups[key]) groups[key] = [];
            groups[key].push(dep);
        });
        return Object.entries(groups).map(([line, deps]) => ({
            line,
            type: deps[0].type,
            departures: deps
        })).sort((a, b) => {
            const timeA = new Date(a.departures[0].timestamp).getTime();
            const timeB = new Date(b.departures[0].timestamp).getTime();
            return timeA - timeB;
        });
    }, [departures]);

    const stopsData = useMemo(() => {
        if (!stops) return null;
        return { type: 'FeatureCollection' as const, features: (stops as any).features };
    }, [stops]);

    const routeShapeData = useMemo(() => {
        if (!selectedVehicle || !vehicleDetail?.shapes?.features) return null;

        const coordinates = vehicleDetail.shapes.features
            .filter((f: any) => f.geometry.type === 'Point')
            .map((f: any) => f.geometry.coordinates);

        if (coordinates.length < 2) {
            return {
                type: 'FeatureCollection' as const,
                features: vehicleDetail.shapes.features
            };
        }

        return {
            type: 'FeatureCollection' as const,
            features: [{
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: coordinates
                },
                properties: {}
            }]
        };
    }, [selectedVehicle, vehicleDetail]);

    const toggleLine = (line: string) => {
        setExpandedLines(prev =>
            prev.includes(line) ? prev.filter(l => l !== line) : [...prev, line]
        );
    };

    return {
        bounds,
        debouncedBounds,
        selectedStop,
        selectedVehicle,
        isFollowing,
        showVehicles,
        isSettingsOpen,
        expandedLines,
        // Setters / Actions
        setSelectedStop,
        setSelectedVehicle,
        setIsFollowing,
        setShowVehicles,
        setIsSettingsOpen,
        handleLocate,
        onMove,
        onMoveEnd,
        onLoad,
        onDragStart,
        handleDepartureClick,
        toggleLine,
        setExpandedLines,
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
        dataUpdatedAt
    };
};
