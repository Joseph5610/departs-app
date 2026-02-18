
import React, { useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import MapGL, { Source, Layer, type MapRef } from 'react-map-gl/maplibre';
import maplibregl, { type Map as MapLibreInstance } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BottomSheet } from './BottomSheet';

import { LiveStatus } from './LiveStatus';
import { getVehicleColor, isNightRoute } from '../utils/vehicleColors';
import { getInitialViewState } from '../utils/mapUtils';
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
import type { TrackedVehicle, VehicleCollection, StopFeature } from '../types/transit';
import { MapControls } from './MapControls';
import { BottomSheetContent } from './BottomSheetContent';
import { MAP_FLY_DURATION, MAP_STOP_SELECT_ZOOM } from '../config/constants';

const EMPTY_GEOJSON: VehicleCollection = {
    type: 'FeatureCollection',
    features: []
};

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export const Map: React.FC = () => {
    const { t } = useTranslation();
    const mapRef = useRef<MapRef>(null);

    const initialViewState = useMemo(() => getInitialViewState(), []);

    const {
        state,
        actions,
        data,
        mapEvents
    } = useMapLogic(mapRef);

    const handleZoomIn = useCallback(() => {
        mapRef.current?.zoomIn();
    }, []);

    const handleZoomOut = useCallback(() => {
        mapRef.current?.zoomOut();
    }, []);

    const handleSettingsOpen = useCallback(() => {
        actions.setIsSettingsOpen(true);
    }, [actions]);

    const handleToggleFollow = useCallback(() => {
        actions.setIsFollowing(!state.isFollowing);
    }, [state.isFollowing, actions]);

    const handleStopSelect = useCallback((stop: StopFeature) => {
        const [lng, lat] = stop.geometry.coordinates;
        mapRef.current?.flyTo({
            center: [lng, lat],
            zoom: MAP_STOP_SELECT_ZOOM,
            duration: MAP_FLY_DURATION
        });
        const pc = stop.properties.platform_code;
        const name = (pc && pc.trim().length > 0) ? `${stop.properties.stop_name} (${pc})` : stop.properties.stop_name;
        actions.setSelectedStop({ id: stop.properties.stop_id, name });
        actions.setSelectedVehicle(null);
        actions.setExpandedGroups([]);
    }, [actions]);

    const handleLineSelect = useCallback((line: string[] | null) => {
        actions.setRouteFilter(line);
    }, [actions]);

    const handleResetBearing = () => {
        mapRef.current?.easeTo({
            bearing: 0,
            duration: 1000,
            pitch: 0
        });
    };


    // Memoize route line color to prevent re-computation on every render
    const routeLineColor = useMemo(() => {
        const routeName = state.selectedVehicle?.gtfs_route_short_name || state.selectedVehicle?.route_short_name || '';
        const routeType = state.selectedVehicle?.route_type || 0;
        return isNightRoute(routeName) ? '#ffffff' : getVehicleColor(routeType, routeName);
    }, [state.selectedVehicle?.gtfs_route_short_name, state.selectedVehicle?.route_short_name, state.selectedVehicle?.route_type]);

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
        ['==', ['to-string', ['coalesce', ['get', 'vehicle_id'], ['get', 'id'], '']], String(state.selectedId || 'NOMATCH')],
        ['==', ['to-string', ['coalesce', ['get', 'gtfs_trip_id'], ['get', 'trip_id'], '']], String(state.selectedVehicle?.gtfs_trip_id || state.selectedVehicle?.trip_id || 'NOMATCH')]
    ]] as any, [state.selectedId, state.selectedVehicle?.gtfs_trip_id, state.selectedVehicle?.trip_id]);

    return (
        <div className="w-full h-full bg-black relative">
            <LiveStatus fetching={data.fetchingVehicles} bounds={state.bounds} lastUpdate={data.dataUpdatedAt} />

            <MapGL
                ref={mapRef}
                initialViewState={initialViewState}
                onMove={mapEvents.onMove}
                onMoveEnd={mapEvents.onMoveEnd}
                onLoad={mapEvents.onLoad}
                style={{ width: '100%', height: '100%' }}
                mapStyle={MAP_STYLE}
                mapLib={maplibregl as unknown as typeof maplibregl}
                onDragStart={mapEvents.onDragStart}
                onMouseEnter={(evt) => {
                    const features = evt.features;
                    if (features?.length && features[0].layer.id !== 'entrance-layer') {
                        (evt.target as unknown as MapLibreInstance).getCanvas().style.cursor = 'pointer';
                    }
                }}
                onMouseLeave={(evt) => {
                    (evt.target as unknown as MapLibreInstance).getCanvas().style.cursor = '';
                }}
                onClick={(evt) => {
                    const f = evt.features?.[0];
                    if (!f || f.layer.id === 'entrance-layer') return;

                    if (f.layer.id === 'clusters') {
                        const clusterId = f.properties.cluster_id;
                        const map = mapRef.current?.getMap() as unknown as MapLibreInstance;
                        const source = map.getSource('pid-stops') as maplibregl.GeoJSONSource;
                        source.getClusterExpansionZoom(clusterId).then((zoom) => {
                            mapRef.current?.easeTo({
                                center: (f.geometry as any).coordinates,
                                zoom,
                                duration: 500
                            });
                        }).catch(() => {
                            // Silent fail
                        });
                        return;
                    }

                    if (f.layer.id === 'vehicles-point' || f.layer.id === 'vehicles-direction-fg' || f.layer.id === 'vehicles-label') {
                        const props = f.properties;
                        actions.setSelectedVehicle({
                            ...props,
                            vehicle_id: String(props.vehicle_id || props.id),
                            _geometry: (f.geometry as any).coordinates as [number, number]
                        } as TrackedVehicle);
                        actions.setSelectedStop(null);
                        actions.setIsFollowing(true);
                        return;
                    }

                    if (f.layer.id === 'unclustered-point' || f.layer.id === 'transfer-stations') {
                        const pc = f.properties.platform_code;
                        const name = (pc && pc.trim().length > 0) ? `${f.properties.stop_name} (${pc})` : f.properties.stop_name;
                        actions.setSelectedStop({ id: f.properties.stop_id, name });
                        actions.setSelectedVehicle(null);
                        actions.setExpandedGroups([]);
                    }
                }}
                interactiveLayerIds={['unclustered-point', 'clusters', 'transfer-stations', 'vehicles-point', 'vehicles-direction-fg', 'vehicles-label']}
            >

                {/* Route Shape Layer - UNDER labels */}
                {state.mapLoaded && (
                    <Source id="route-shape" type="geojson" data={data.routeShapeData || EMPTY_GEOJSON}>
                        <Layer
                            id="route-line"
                            type="line"
                            beforeId={state.labelLayerId}
                            layout={routeLineLayout}
                            paint={routeLinePaint}
                        />
                    </Source>
                )}

                <Search
                    stops={data.stops || null}
                    onSelect={handleStopSelect}
                    onLineSelect={handleLineSelect}
                    activeFilter={state.routeFilter}
                />

                <MapControls
                    mapRef={mapRef}
                    mapLoaded={state.mapLoaded}
                    onLocate={actions.handleLocate}
                    onSettings={handleSettingsOpen}
                    onZoomIn={handleZoomIn}
                    onZoomOut={handleZoomOut}
                    onResetBearing={handleResetBearing}
                />

                <Source id="user-location" type="geojson" data={(state.mapLoaded && state.userLocation ? {
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: state.userLocation },
                        properties: {}
                    }]
                } : EMPTY_GEOJSON) as VehicleCollection}>
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


                <Source id="selected-vehicle" type="geojson" data={data.selectedVehicleFeature}>
                    {/* 1. PULSE (Bottom) */}
                    <Layer {...selectedVehiclePulseLayer} />
                    {/* 2. BODY */}
                    <Layer {...selectedVehiclePointLayer} />
                    {/* 3. DIRECTION */}
                    <Layer {...selectedVehicleDirectionLayer} />
                    {/* 4. LABEL */}
                    <Layer {...selectedVehicleLabelLayer} />
                </Source>

                <Source id="pid-vehicles" type="geojson" data={state.mapLoaded && state.showVehicles && data.displayVehicles ? data.displayVehicles : EMPTY_GEOJSON}>
                    {/* Main Vehicles Layer - EXCLUDE SELECTED (By Vehicle ID OR Trip ID) */}
                    <Layer {...vehiclesPointLayer} filter={vehiclesFilter} />

                    {/* DIRECTION ARROWS - EXCLUDE SELECTED */}
                    <Layer {...vehiclesDirectionLayer} filter={vehiclesFilter} />

                    {/* LABELS - EXCLUDE SELECTED */}
                    <Layer {...vehiclesLabelLayer} filter={vehiclesFilter} />
                </Source>

                <Source id="stop-labels-centroids" type="geojson" data={state.mapLoaded && data.labelData ? data.labelData : EMPTY_GEOJSON}>
                    <Layer {...stopLabelLayer} />
                </Source>

                <Source
                    id="pid-stops"
                    type="geojson"
                    data={state.mapLoaded && data.stopsData ? data.stopsData : EMPTY_GEOJSON}
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
                <WelcomeModal onGetStarted={actions.handleLocate} />
                <SettingsModal
                    isOpen={state.isSettingsOpen}
                    onClose={() => actions.setIsSettingsOpen(false)}
                    showVehicles={state.showVehicles}
                    setShowVehicles={actions.setShowVehicles}
                />
                <UpdatePopup />
            </React.Suspense>

            <BottomSheet
                isOpen={!!state.selectedStop || !!state.selectedVehicle}
                onClose={() => { actions.setSelectedStop(null); actions.setSelectedVehicle(null); actions.setIsFollowing(false); }}
                onBack={(state.selectedVehicle && state.selectedStop) ? () => {
                    actions.setSelectedVehicle(null);
                    actions.setIsFollowing(false);
                } : undefined}
                title={state.selectedVehicle
                    ? t('map.vehicleDetails.lineLabel', { line: state.selectedVehicle.gtfs_route_short_name || state.selectedVehicle.route_short_name })
                    : (state.selectedStop ? state.selectedStop.name : '')}
            >
                <BottomSheetContent
                    selectedStop={state.selectedStop}
                    selectedVehicle={state.selectedVehicle}
                    vehicleDetail={data.vehicleDetail || null}
                    loadingDetail={data.loadingDetail}
                    isFollowing={state.isFollowing}
                    onToggleFollow={handleToggleFollow}
                    groupedDepartures={data.groupedDepartures}
                    expandedGroups={state.expandedGroups}
                    onToggleGroup={actions.toggleGroup}
                    onDepartureClick={actions.handleDepartureClick}
                    departureSort={state.departureSort}
                    setDepartureSort={actions.setDepartureSort}
                    loadingDeps={data.loadingDeps}
                />
            </BottomSheet>
        </div>
    );
};
