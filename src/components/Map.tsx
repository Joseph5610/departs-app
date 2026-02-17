
import React, { useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import MapGL, { Source, Layer, type MapRef } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BottomSheet } from './BottomSheet';

import { LiveStatus } from './LiveStatus';
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
import { useMapStyles } from '../hooks/useMapStyles';
import { useMapClickHandlers } from '../hooks/useMapClickHandlers';
import type { StopFeature } from '../types/transit';
import { MapControls } from './MapControls';
import { BottomSheetContent } from './BottomSheetContent';
import {
    EMPTY_GEOJSON,
    MAP_STYLE_URL,
    MAP_DEFAULT_COORDS,
    MAP_DEFAULT_ZOOM,
    MAP_USER_LOCATION_ZOOM,
    LS_KEYS,
    MAP_FLY_DURATION_MS
} from '../config/constants';

export const Map: React.FC = () => {
    const { t } = useTranslation();
    const mapRef = useRef<MapRef>(null);

    const initialViewState = useMemo(() => {
        const p = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');

        let lat = MAP_DEFAULT_COORDS.lat;
        let lng = MAP_DEFAULT_COORDS.lng;
        let z = MAP_DEFAULT_ZOOM;

        if (typeof window !== 'undefined' && !p.has('lat') && !p.has('lng')) {
            const saved = localStorage.getItem(LS_KEYS.LAST_USER_LOCATION);
            if (saved) {
                try {
                    const { lat: sLat, lng: sLng } = JSON.parse(saved);
                    if (typeof sLat === 'number' && typeof sLng === 'number') {
                        lat = sLat;
                        lng = sLng;
                        z = MAP_USER_LOCATION_ZOOM;
                    }
                } catch (e) {
                    console.error(`Failed to parse ${LS_KEYS.LAST_USER_LOCATION}`, e);
                }
            }
        }

        return {
            latitude: parseFloat(p.get('lat') || lat.toString()),
            longitude: parseFloat(p.get('lng') || lng.toString()),
            zoom: parseFloat(p.get('z') || z.toString())
        };
    }, []);

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

    const {
        routeLinePaint,
        routeLineLayout,
        vehiclesFilter
    } = useMapStyles(selectedVehicle, selectedId);

    const onMapClick = useMapClickHandlers(
        mapRef,
        setSelectedVehicle,
        setSelectedStop,
        setIsFollowing,
        setExpandedGroups
    );

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

    const handleStopSelect = useCallback((stop: StopFeature) => {
        const [lng, lat] = stop.geometry.coordinates;
        mapRef.current?.flyTo({
            center: [lng, lat],
            zoom: 16,
            duration: MAP_FLY_DURATION_MS
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

    return (
        <div className="w-full h-full bg-black relative">
            <LiveStatus fetching={fetchingVehicles} bounds={bounds} lastUpdate={dataUpdatedAt} />

            <MapGL
                ref={mapRef}
                initialViewState={initialViewState}
                onMove={onMove}
                onMoveEnd={onMoveEnd}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onLoad={onLoad as any}
                style={{ width: '100%', height: '100%' }}
                mapStyle={MAP_STYLE_URL}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                onClick={onMapClick}
                interactiveLayerIds={['unclustered-point', 'clusters', 'transfer-stations', 'vehicles-point', 'vehicles-direction-fg', 'vehicles-label']}
            >

                {/* Route Shape Layer - UNDER labels */}
                {mapLoaded && (
                    <Source id="route-shape" type="geojson" data={routeShapeData || EMPTY_GEOJSON}>
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
                    stops={stops || null}
                    onSelect={handleStopSelect}
                    onLineSelect={handleLineSelect}
                    activeFilter={routeFilter}
                />

                <MapControls
                    mapRef={mapRef}
                    mapLoaded={mapLoaded}
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
                } : EMPTY_GEOJSON)}>
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


                <Source id="selected-vehicle" type="geojson" data={selectedVehicleFeature}>
                    {/* 1. PULSE (Bottom) */}
                    <Layer {...selectedVehiclePulseLayer} />
                    {/* 2. BODY */}
                    <Layer {...selectedVehiclePointLayer} />
                    {/* 3. DIRECTION */}
                    <Layer {...selectedVehicleDirectionLayer} />
                    {/* 4. LABEL */}
                    <Layer {...selectedVehicleLabelLayer} />
                </Source>

                <Source id="pid-vehicles" type="geojson" data={(mapLoaded && showVehicles && displayVehicles ? displayVehicles : EMPTY_GEOJSON)}>
                    {/* Main Vehicles Layer - EXCLUDE SELECTED (By Vehicle ID OR Trip ID) */}
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Layer {...(vehiclesPointLayer as any)} filter={vehiclesFilter as any} />

                    {/* DIRECTION ARROWS - EXCLUDE SELECTED */}
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Layer {...(vehiclesDirectionLayer as any)} filter={vehiclesFilter as any} />

                    {/* LABELS - EXCLUDE SELECTED */}
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Layer {...(vehiclesLabelLayer as any)} filter={vehiclesFilter as any} />
                </Source>

                <Source id="stop-labels-centroids" type="geojson" data={(mapLoaded && labelData ? labelData : EMPTY_GEOJSON)}>
                    <Layer {...stopLabelLayer} />
                </Source>

                <Source
                    id="pid-stops"
                    type="geojson"
                    data={(mapLoaded && stopsData ? stopsData : EMPTY_GEOJSON)}
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
                onBack={(selectedVehicle && selectedStop) ? () => {
                    setSelectedVehicle(null);
                    setIsFollowing(false);
                } : undefined}
                title={selectedVehicle
                    ? t('map.vehicleDetails.lineLabel', { line: selectedVehicle.gtfs_route_short_name || selectedVehicle.route_short_name })
                    : (selectedStop ? selectedStop.name : '')}
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
