
import React, { useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    type Map as MapLibreInstance,
    type LineLayerSpecification
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DetailPanel } from './DetailPanel';

import { LiveStatus } from './LiveStatus';
import { getVehicleColor, isNightRoute } from '../utils/vehicleColors';
const SettingsModal = React.lazy(() => import('./SettingsModal').then(module => ({ default: module.SettingsModal })));
const WelcomeModal = React.lazy(() => import('./WelcomeModal').then(module => ({ default: module.WelcomeModal })));
const UpdatePopup = React.lazy(() => import('./UpdatePopup').then(module => ({ default: module.UpdatePopup })));
import { Search } from './Search';
import { MapLayers } from './MapLayers';
import { MapProvider } from '../contexts/MapContext';
import { useMap } from '../hooks/useMap';
import type { TrackedVehicle } from '../types/transit';
import { MapControls } from './MapControls';
import { DetailPanelContent } from './DetailPanelContent';
import { useVehicles } from '../hooks/useVehicles';
import { useMapStops } from '../hooks/useMapStops';
import { useMapCentroids } from '../hooks/useMapCentroids';
import { useRouteShape } from '../hooks/useRouteShape';
import { useMapFilters } from '../hooks/useMapFilters';

// Import mapcn components
import { Map as Mapcn } from '@/components/ui/map';

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

    // Data Hooks
    const { vehicles: displayVehicles } = useVehicles();
    const stopsData = useMapStops();
    const labelData = useMapCentroids();
    const routeShapeData = useRouteShape();

    const handleToggleFollow = useCallback(() => {
        actions.setIsFollowing(!state.isFollowing);
    }, [state.isFollowing, actions]);

    const { selectedVehicleFeature, vehiclesFilter } = useMapFilters(state.selectedVehicle, state.selectedId ? String(state.selectedId) : null);

    const handleBack = useCallback(() => {
        actions.setSelectedVehicle(null);
        actions.setIsFollowing(false);
    }, [actions]);

    const panelTitle = useMemo(() => {
        if (state.selectedVehicle) {
            return t('map.vehicleDetails.lineLabel', { line: state.selectedVehicle.gtfs_route_short_name || state.selectedVehicle.route_short_name });
        }
        return state.selectedStop ? state.selectedStop.name : '';
    }, [state.selectedVehicle, state.selectedStop, t]);

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

    // Sync mapcn ref with our context's mapRef
    const onMapInstance = useCallback((instance: MapLibreInstance | null) => {
        (mapRef as any).current = instance;
    }, [mapRef]);

    return (
        <>
            <Mapcn
                ref={onMapInstance}
                viewport={state.viewport}
                onViewportChange={(viewport) => {
                    mapEvents.onMove({
                        viewState: { zoom: viewport.zoom },
                        target: mapRef.current as MapLibreInstance
                    });
                }}
                onMoveEnd={(viewport) => {
                    mapEvents.onMoveEnd({
                        viewState: {
                            latitude: viewport.center[1],
                            longitude: viewport.center[0],
                            zoom: viewport.zoom,
                            bearing: viewport.bearing,
                            pitch: viewport.pitch
                        },
                        target: mapRef.current as MapLibreInstance
                    });
                }}
                onLoad={(e) => {
                    mapEvents.onLoad({ target: e.target });
                }}
                className="w-full h-full"
                styles={{
                    dark: MAP_STYLE,
                    light: MAP_STYLE // Keep dark for now
                }}
                onClick={(evt: any) => {
                    const map = mapRef.current;
                    if (!map) return;

                    const features = map.queryRenderedFeatures(evt.point);
                    if (!features.length) return;

                    // Prioritize interactive layers
                    const interactiveLayerIds = [
                        'clusters',
                        'vehicles-delay-label',
                        'vehicles-point',
                        'vehicles-direction-all',
                        'vehicles-label-all',
                        'unclustered-point',
                        'transfer-stations',
                        'platform-labels'
                    ];

                    const f = features.find(feat => interactiveLayerIds.includes(feat.layer.id));
                    if (!f) return;

                    if (f.layer.id === 'clusters' || (f.layer.id === 'vehicles-delay-label' && f.properties.point_count)) {
                        const clusterId = f.properties.cluster_id;
                        const sourceId = f.layer.id === 'clusters' ? 'pid-stops' : 'pid-vehicles';
                        const source = map.getSource(sourceId) as any;
                        source.getClusterExpansionZoom(clusterId).then((zoom: number) => {
                            map.easeTo({
                                center: (f.geometry as { type: 'Point'; coordinates: [number, number] }).coordinates,
                                zoom,
                                duration: 500
                            });
                        }).catch(() => {
                            // Silent fail
                        });
                        return;
                    }

                    if (f.layer.id === 'vehicles-point' || f.layer.id === 'vehicles-direction-all' || f.layer.id === 'vehicles-label-all' || f.layer.id === 'vehicles-delay-label') {
                        const props = f.properties as any;
                        actions.selectVehicle({
                            ...props,
                            vehicle_id: String(props.vehicle_id || props.id),
                            _geometry: (f.geometry as { type: 'Point'; coordinates: [number, number] }).coordinates
                        } as TrackedVehicle, false); // clear stop
                        return;
                    }

                    if (f.layer.id === 'unclustered-point' || f.layer.id === 'transfer-stations' || f.layer.id === 'platform-labels') {
                        const props = f.properties as any;
                        actions.selectStop({
                            id: props.stop_id,
                            name: props.stop_name,
                            platformCode: props.platform_code,
                            coordinates: (f.geometry as { type: 'Point'; coordinates: [number, number] }).coordinates
                        });
                    }
                }}
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
                    favoriteStops={state.favoriteStops}
                    routeLinePaint={routeLinePaint}
                    routeLineLayout={routeLineLayout}
                    vehiclesFilter={vehiclesFilter}
                    labelLayerId={state.labelLayerId}
                />
                <LiveStatus />
                <Search />
                <MapControls />
            </Mapcn>

            <React.Suspense fallback={null}>
                <WelcomeModal />
                <SettingsModal />
                <UpdatePopup />
            </React.Suspense>

            <DetailPanel
                isOpen={!!state.selectedStop || !!state.selectedVehicle}
                onClose={actions.clearSelection}
                onBack={(state.selectedVehicle && state.selectedStop) ? handleBack : undefined}
                title={panelTitle}
                platformCode={!state.selectedVehicle ? state.selectedStop?.platformCode : undefined}
            >
                <DetailPanelContent
                    onToggleFollow={handleToggleFollow}
                />
            </DetailPanel>
        </>
    );
};

/**
 * Map Component (Entry Point)
 *
 * Initializes the MapProvider and sets up the map reference.
 * This is the root component for the map view.
 */
export const Map: React.FC = () => {
    const mapRef = useRef<MapLibreInstance>(null);

    return (
        <MapProvider mapRef={mapRef}>
            <MapInner />
        </MapProvider>
    );
};
