
import React, { useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import MapGL, { Source, Layer, type MapRef } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BottomSheet } from './BottomSheet';

import { LiveStatus } from './LiveStatus';
import { getVehicleColor, isNightRoute } from '../utils/vehicleColors';
const SettingsModal = React.lazy(() => import('./SettingsModal').then(module => ({ default: module.SettingsModal })));
const WelcomeModal = React.lazy(() => import('./WelcomeModal').then(module => ({ default: module.WelcomeModal })));
const UpdatePopup = React.lazy(() => import('./UpdatePopup').then(module => ({ default: module.UpdatePopup })));
import { Search } from './Search';
import {
    clusterLayer,
    clusterCountLayer,
    stopPointLayer,
    transferStationLayer,
    stopLabelLayer,
    platformLabelLayer,
    entranceLayer,
    stopPointGlowLayer,
    selectedVehiclePulseLayer,
    selectedVehiclePointLayer,
    selectedVehicleDirectionLayer,
    selectedVehicleLabelLayer,
    vehiclesPointLayer,
    vehiclesDirectionLayer,
    vehiclesLabelLayer
} from '../config/mapLayers';
import { useMapLogic } from '../hooks/useMapLogic';
import type { TrackedVehicle } from '../types/transit';
import { MapControls } from './MapControls';
import { BottomSheetContent } from './BottomSheetContent';

const EMPTY_GEOJSON: any = {
    type: 'FeatureCollection',
    features: []
};

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const INITIAL = (() => {
    const p = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    return {
        lat: parseFloat(p.get('lat') || '50.0755'),
        lng: parseFloat(p.get('lng') || '14.4378'),
        z: parseFloat(p.get('z') || '13')
    };
})();



export const Map: React.FC = () => {
    const { t } = useTranslation();
    const mapRef = useRef<MapRef>(null);

    const {
        bounds,
        selectedStop,
        selectedVehicle,
        isFollowing,
        showVehicles,
        isSettingsOpen,
        expandedGroups,
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
        toggleGroup,
        setExpandedGroups,
        displayVehicles,
        vehicleDetail,
        loadingDetail,
        stopsData,
        labelData,
        groupedDepartures,
        stops,
        loadingDeps,
        routeShapeData,
        fetchingVehicles,
        dataUpdatedAt,
        departureSort,
        setDepartureSort,
        userLocation,
        mapLoaded,
        selectedVehicleFeature,
        labelLayerId,
        selectedId,
        routeFilter,
        setRouteFilter
    } = useMapLogic(mapRef);

    const handleZoomIn = useCallback(() => {
        mapRef.current?.zoomIn();
    }, []);

    const handleZoomOut = useCallback(() => {
        mapRef.current?.zoomOut();
    }, []);

    const handleSettingsOpen = useCallback(() => {
        setIsSettingsOpen(true);
    }, [setIsSettingsOpen]);

    const handleToggleFollow = useCallback(() => {
        setIsFollowing(prev => !prev);
    }, [setIsFollowing]);

    const handleStopSelect = useCallback((stop: any) => {
        const [lng, lat] = stop.geometry.coordinates;
        mapRef.current?.flyTo({
            center: [lng, lat],
            zoom: 16,
            duration: 2000
        });
        const pc = stop.properties.platform_code;
        const name = (pc && pc.trim().length > 0) ? `${stop.properties.stop_name} (${pc})` : stop.properties.stop_name;
        setSelectedStop({ id: stop.properties.stop_id, name });
        setSelectedVehicle(null);
        setExpandedGroups([]);
    }, [setSelectedStop, setSelectedVehicle, setExpandedGroups]);

    const handleLineSelect = useCallback((line: string[] | null) => {
        setRouteFilter(line);
    }, [setRouteFilter]);

    const handleResetBearing = () => {
        mapRef.current?.easeTo({
            bearing: 0,
            duration: 1000,
            pitch: 0
        });
    };

    // Memoize route line color to prevent re-computation on every render
    const routeLineColor = useMemo(() => {
        const routeName = selectedVehicle?.gtfs_route_short_name || selectedVehicle?.route_short_name || selectedVehicle?.n || '';
        const routeType = selectedVehicle?.route_type || selectedVehicle?.t || 0;
        return isNightRoute(routeName) ? '#ffffff' : getVehicleColor(routeType, routeName);
    }, [selectedVehicle?.gtfs_route_short_name, selectedVehicle?.route_short_name, selectedVehicle?.n, selectedVehicle?.route_type, selectedVehicle?.t]);

    // Memoize route line paint object
    const routeLinePaint = useMemo(() => ({
        'line-color': routeLineColor,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 15, 8] as any,
        'line-opacity': 0.8,
        'line-blur': 0.5
    }), [routeLineColor]);

    // Memoize route line layout object
    const routeLineLayout = useMemo(() => ({
        'line-join': 'round' as const,
        'line-cap': 'round' as const
    }), []);

    // Memoize vehicle filter to exclude selected vehicle
    const vehiclesFilter = useMemo(() => ['!', ['any',
        ['==', ['to-string', ['coalesce', ['get', 'vehicle_id'], ['get', 'id'], '']], String(selectedId || 'NOMATCH')],
        ['==', ['to-string', ['coalesce', ['get', 'gtfs_trip_id'], ['get', 'trip_id'], '']], String(selectedVehicle?.gtfs_trip_id || selectedVehicle?.trip_id || 'NOMATCH')]
    ]], [selectedId, selectedVehicle?.gtfs_trip_id, selectedVehicle?.trip_id]);

    return (
        <div className="w-full h-full bg-black relative">
            <LiveStatus fetching={fetchingVehicles} bounds={bounds} lastUpdate={dataUpdatedAt} />

            <MapGL
                ref={mapRef}
                initialViewState={{ latitude: INITIAL.lat, longitude: INITIAL.lng, zoom: INITIAL.z }}
                onMove={onMove}
                onMoveEnd={onMoveEnd}
                onLoad={onLoad}
                style={{ width: '100%', height: '100%' }}
                mapStyle={MAP_STYLE}
                mapLib={maplibregl as any}
                onDragStart={onDragStart}
                onMouseEnter={(evt) => {
                    const features = evt.features;
                    if (features?.length && features[0].layer.id !== 'entrance-layer') {
                        evt.target.getCanvas().style.cursor = 'pointer';
                    }
                }}
                onMouseLeave={(evt) => {
                    evt.target.getCanvas().style.cursor = '';
                }}
                onClick={(evt) => {
                    const f = evt.features?.[0];
                    if (!f || f.layer.id === 'entrance-layer') return;

                    if (f.layer.id === 'clusters') {
                        const clusterId = f.properties.cluster_id;
                        const source = (mapRef.current!.getMap() as any).getSource('pid-stops');
                        source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
                            if (err) return;
                            mapRef.current?.easeTo({
                                center: (f.geometry as any).coordinates,
                                zoom,
                                duration: 500
                            });
                        });
                        return;
                    }

                    if (f.layer.id === 'vehicles-point' || f.layer.id === 'vehicles-direction-fg' || f.layer.id === 'vehicles-label') {
                        const props = f.properties;
                        setSelectedVehicle({
                            ...props,
                            vehicle_id: String(props.vehicle_id || props.id),
                            _geometry: (f.geometry as any).coordinates as [number, number]
                        } as TrackedVehicle);
                        setSelectedStop(null);
                        setIsFollowing(true);
                        return;
                    }

                    if (f.layer.id === 'unclustered-point' || f.layer.id === 'transfer-stations') {
                        const pc = f.properties.platform_code;
                        const name = (pc && pc.trim().length > 0) ? `${f.properties.stop_name} (${pc})` : f.properties.stop_name;
                        setSelectedStop({ id: f.properties.stop_id, name });
                        setSelectedVehicle(null);
                        setExpandedGroups([]);
                    }
                }}
                interactiveLayerIds={['unclustered-point', 'clusters', 'transfer-stations', 'vehicles-point', 'vehicles-direction-fg', 'vehicles-label']}
            >

                {/* Route Shape Layer - UNDER labels */}
                {mapLoaded && (
                    <Source id="route-shape" type="geojson" data={routeShapeData || (EMPTY_GEOJSON as any)}>
                        <Layer
                            id="route-line"
                            type="line"
                            beforeId={labelLayerId}
                            layout={routeLineLayout}
                            paint={routeLinePaint}
                        />
                    </Source>
                )}

                <Search
                    stops={stops as any}
                    onSelect={handleStopSelect}
                    onLineSelect={handleLineSelect}
                    activeFilter={routeFilter}
                />

                <MapControls
                    onLocate={handleLocate}
                    onSettings={handleSettingsOpen}
                    onZoomIn={handleZoomIn}
                    onZoomOut={handleZoomOut}
                    onResetBearing={handleResetBearing}
                />

                <Source id="user-location" type="geojson" data={(mapLoaded && userLocation ? {
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: userLocation },
                        properties: {}
                    }]
                } : EMPTY_GEOJSON) as any}>
                    <Layer
                        id="user-location-pulse"
                        type="circle"
                        paint={{
                            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 15, 15, 30],
                            'circle-color': '#3b82f6',
                            'circle-opacity': 0.15,
                        }}
                    />
                    <Layer
                        id="user-location-point"
                        type="circle"
                        paint={{
                            'circle-radius': 7,
                            'circle-color': '#3b82f6',
                            'circle-stroke-width': 2,
                            'circle-stroke-color': '#FFFFFF'
                        }}
                    />
                </Source>


                <Source id="selected-vehicle" type="geojson" data={selectedVehicleFeature as any}>
                    {/* 1. PULSE (Bottom) */}
                    <Layer {...selectedVehiclePulseLayer} />
                    {/* 2. BODY */}
                    <Layer {...selectedVehiclePointLayer} />
                    {/* 3. DIRECTION */}
                    <Layer {...selectedVehicleDirectionLayer} />
                    {/* 4. LABEL */}
                    <Layer {...selectedVehicleLabelLayer} />
                </Source>

                <Source id="pid-vehicles" type="geojson" data={(mapLoaded && showVehicles && displayVehicles ? displayVehicles : EMPTY_GEOJSON) as any}>
                    {/* Main Vehicles Layer - EXCLUDE SELECTED (By Vehicle ID OR Trip ID) */}
                    <Layer {...vehiclesPointLayer} filter={vehiclesFilter} />

                    {/* DIRECTION ARROWS - EXCLUDE SELECTED */}
                    <Layer {...vehiclesDirectionLayer} filter={vehiclesFilter} />

                    {/* LABELS - EXCLUDE SELECTED */}
                    <Layer {...vehiclesLabelLayer} filter={vehiclesFilter} />
                </Source>

                <Source id="stop-labels-centroids" type="geojson" data={(mapLoaded && labelData ? labelData : EMPTY_GEOJSON) as any}>
                    <Layer {...stopLabelLayer} />
                </Source>

                <Source
                    id="pid-stops"
                    type="geojson"
                    data={(mapLoaded && stopsData ? stopsData : EMPTY_GEOJSON) as any}
                    cluster={true}
                    clusterMaxZoom={13}
                    clusterRadius={40}
                    clusterProperties={{
                        has_metro_a: ['max', ['get', 'metro_a']],
                        has_metro_b: ['max', ['get', 'metro_b']],
                        has_metro_c: ['max', ['get', 'metro_c']],
                        cluster_seed: ['max', ['get', 'variant_seed']]
                    }}
                >
                    <Layer {...clusterLayer} />
                    <Layer {...clusterCountLayer} />
                    <Layer {...stopPointGlowLayer} />
                    <Layer {...stopPointLayer} />
                    <Layer {...transferStationLayer} />
                    <Layer {...platformLabelLayer} />
                    <Layer {...entranceLayer} />
                </Source>
            </MapGL>

            <React.Suspense fallback={null}>
                <WelcomeModal onGetStarted={handleLocate} />
                <SettingsModal
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    showVehicles={showVehicles}
                    setShowVehicles={setShowVehicles}
                />
                <UpdatePopup />
            </React.Suspense>

            <BottomSheet
                isOpen={!!selectedStop || !!selectedVehicle}
                onClose={() => { setSelectedStop(null); setSelectedVehicle(null); setIsFollowing(false); }}
                title={selectedStop ? selectedStop.name : (selectedVehicle && window.innerWidth >= 768 ? t('map.vehicleDetails.lineLabel', { line: selectedVehicle.gtfs_route_short_name || selectedVehicle.route_short_name || selectedVehicle.n }) : '')}
            >
                <BottomSheetContent
                    selectedStop={selectedStop}
                    selectedVehicle={selectedVehicle}
                    vehicleDetail={vehicleDetail || null}
                    loadingDetail={loadingDetail}
                    isFollowing={isFollowing}
                    onToggleFollow={handleToggleFollow}
                    groupedDepartures={groupedDepartures}
                    expandedGroups={expandedGroups}
                    onToggleGroup={toggleGroup}
                    onDepartureClick={handleDepartureClick}
                    departureSort={departureSort}
                    setDepartureSort={setDepartureSort}
                    loadingDeps={loadingDeps}
                />
            </BottomSheet>
        </div>
    );
};
