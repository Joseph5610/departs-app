
import React, { useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import MapGL, { type MapRef } from 'react-map-gl/maplibre';
import maplibregl, {
    type Map as MapLibreInstance,
    type LineLayerSpecification
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BottomSheet } from './BottomSheet';

import { LiveStatus } from './LiveStatus';
import { getVehicleColor, isNightRoute } from '../utils/vehicleColors';
import { getInitialViewState } from '../utils/mapUtils';
const SettingsModal = React.lazy(() => import('./SettingsModal').then(module => ({ default: module.SettingsModal })));
const WelcomeModal = React.lazy(() => import('./WelcomeModal').then(module => ({ default: module.WelcomeModal })));
const UpdatePopup = React.lazy(() => import('./UpdatePopup').then(module => ({ default: module.UpdatePopup })));
import { Search } from './Search';
import { MapLayers } from './MapLayers';
import { MapProvider } from '../contexts/MapContext';
import { useMap } from '../hooks/useMap';
import type { TrackedVehicle } from '../types/transit';
import { MapControls } from './MapControls';
import { BottomSheetContent } from './BottomSheetContent';
import { useVehicles } from '../hooks/useVehicles';
import { useMapStops } from '../hooks/useMapStops';
import { useMapCentroids } from '../hooks/useMapCentroids';
import { useRouteShape } from '../hooks/useRouteShape';
import { useMapFilters } from '../hooks/useMapFilters';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

/**
 * MapInner Component
 *
 * Consumes MapContext and manages the layout of the map and its overlays.
 * It separates data fetching and UI state from the actual MapLibre rendering (MapLayers).
 */
const MapInner: React.FC = () => {
    const { t } = useTranslation();
    const { state, actions, mapEvents, mapRef } = useMap();

    // Ensure full-screen and prevent bouncing on iOS
    React.useEffect(() => {
        const html = document.documentElement;
        const body = document.body;
        const root = document.getElementById('root');

        html.classList.add('h-full', 'overflow-hidden');
        body.classList.add('h-full', 'overflow-hidden', 'bg-black', 'm-0', 'p-0');
        if (root) root.classList.add('h-full');

        // iOS specific position fix for PWA standalone mode
        if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
            body.style.height = '-webkit-fill-available';
            body.style.position = 'fixed';
            body.style.width = '100%';
        }
    }, []);

    // Data Hooks
    const { vehicles: displayVehicles } = useVehicles();
    const stopsData = useMapStops();
    const labelData = useMapCentroids();
    const routeShapeData = useRouteShape();

    const initialViewState = useMemo(() => getInitialViewState(), []);

    const handleToggleFollow = useCallback(() => {
        actions.setIsFollowing(!state.isFollowing);
    }, [state.isFollowing, actions]);

    const { selectedVehicleFeature, vehiclesFilter } = useMapFilters(state.selectedVehicle, state.selectedId ? String(state.selectedId) : null);

    // Memoize route line color to prevent re-computation on every render
    const routeLineColor = useMemo(() => {
        const routeName = state.selectedVehicle?.gtfs_route_short_name || state.selectedVehicle?.route_short_name || '';
        const routeType = state.selectedVehicle?.route_type || 0;
        return isNightRoute(routeName) ? '#ffffff' : getVehicleColor(routeType, routeName);
    }, [state.selectedVehicle?.gtfs_route_short_name, state.selectedVehicle?.route_short_name, state.selectedVehicle?.route_type]);

    // Memoize route line paint object
    const routeLinePaint = useMemo<NonNullable<LineLayerSpecification['paint']>>(() => ({
        'line-color': routeLineColor,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 15, 8],
        'line-opacity': 0.8,
        'line-blur': 0.5
    }), [routeLineColor]);

    // Memoize route line layout object
    const routeLineLayout = useMemo<NonNullable<LineLayerSpecification['layout']>>(() => ({
        'line-join': 'round',
        'line-cap': 'round'
    }), []);

    return (
        <div className="fixed inset-0 bg-black overflow-hidden select-none h-[100dvh] w-screen">
            <div className="absolute inset-0 h-full w-full">
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
                                center: (f.geometry as { type: 'Point'; coordinates: [number, number] }).coordinates,
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
                        actions.selectVehicle({
                            ...props,
                            vehicle_id: String(props.vehicle_id || props.id),
                            _geometry: (f.geometry as { type: 'Point'; coordinates: [number, number] }).coordinates
                        } as TrackedVehicle, false); // clear stop
                        return;
                    }

                    if (f.layer.id === 'unclustered-point' || f.layer.id === 'transfer-stations') {
                        const pc = f.properties.platform_code;
                        const name = (pc && pc.trim().length > 0) ? `${f.properties.stop_name} (${pc})` : f.properties.stop_name;
                        actions.selectStop({ id: f.properties.stop_id, name });
                    }
                }}
                    interactiveLayerIds={['unclustered-point', 'clusters', 'transfer-stations', 'vehicles-point', 'vehicles-direction-fg', 'vehicles-label']}
                >
                    <MapLayers
                        mapLoaded={state.mapLoaded}
                        showVehicles={state.showVehicles}
                        displayVehicles={displayVehicles || null}
                        stopsData={stopsData}
                        labelData={labelData}
                        routeShapeData={routeShapeData}
                        userLocation={state.userLocation}
                        selectedVehicleFeature={selectedVehicleFeature}
                        routeLinePaint={routeLinePaint}
                        routeLineLayout={routeLineLayout}
                        vehiclesFilter={vehiclesFilter}
                        labelLayerId={state.labelLayerId}
                    />
                </MapGL>
            </div>

            <LiveStatus />

            <Search />
            <MapControls />

            <React.Suspense fallback={null}>
                <WelcomeModal />
                <SettingsModal />
                <UpdatePopup />
            </React.Suspense>

            <BottomSheet
                isOpen={!!state.selectedStop || !!state.selectedVehicle}
                onClose={() => actions.clearSelection()}
                onBack={(state.selectedVehicle && state.selectedStop) ? () => {
                    actions.setSelectedVehicle(null);
                    actions.setIsFollowing(false);
                } : undefined}
                title={state.selectedVehicle
                    ? t('map.vehicleDetails.lineLabel', { line: state.selectedVehicle.gtfs_route_short_name || state.selectedVehicle.route_short_name })
                    : (state.selectedStop ? state.selectedStop.name : '')}
            >
                <BottomSheetContent
                    onToggleFollow={handleToggleFollow}
                />
            </BottomSheet>
        </div>
    );
};

/**
 * Map Component (Entry Point)
 *
 * Initializes the MapProvider and sets up the map reference.
 * This is the root component for the map view.
 */
export const Map: React.FC = () => {
    const mapRef = useRef<MapRef>(null);

    return (
        <MapProvider mapRef={mapRef}>
            <MapInner />
        </MapProvider>
    );
};
