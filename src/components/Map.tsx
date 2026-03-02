
import React, { useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import MapGL, { type MapRef } from 'react-map-gl/maplibre';
import maplibregl, {
    type Map as MapLibreInstance
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DetailPanel } from './DetailPanel/DetailPanel';

import { LiveStatus } from './LiveStatus';
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
import { DetailPanelContent } from './DetailPanel/DetailPanelContent';
import { useVehicles } from '../hooks/useVehicles';
import { useStops } from '../hooks/useStops';
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

    // Data Hooks
    const { vehicles: displayVehicles } = useVehicles();
    const { stops: stopsData, centroids: labelData } = useStops();
    const routeShapeData = useRouteShape();

    const initialViewState = useMemo(() => getInitialViewState(), []);

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

    return (
        <>
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
                        const sourceId = 'pid-stops';
                        const source = map.getSource(sourceId) as maplibregl.GeoJSONSource;
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

                    if (f.layer.id === 'vehicles-point' || f.layer.id === 'vehicles-direction-all' || f.layer.id === 'vehicles-label-all') {
                        const props = f.properties;
                        actions.selectVehicle({
                            ...props,
                            vehicle_id: String(props.vehicle_id || props.id),
                            _geometry: (f.geometry as { type: 'Point'; coordinates: [number, number] }).coordinates
                        } as TrackedVehicle, false); // clear stop
                        return;
                    }

                    if (f.layer.id === 'unclustered-point' || f.layer.id === 'train-stations' || f.layer.id === 'transfer-stations') {
                        actions.selectStop({
                            id: f.properties.stop_id,
                            name: f.properties.stop_name,
                            platformCode: f.properties.platform_code,
                            isTrain: f.properties.is_train === 1,
                            coordinates: (f.geometry as { type: 'Point'; coordinates: [number, number] }).coordinates
                        });
                    }
                }}
                interactiveLayerIds={['unclustered-point', 'train-stations', 'clusters', 'transfer-stations', 'vehicles-point', 'vehicles-direction-all', 'vehicles-label-all']}
            >
                <MapLayers
                    mapLoaded={state.mapLoaded}
                    showVehicles={state.showVehicles}
                    showStops={state.showStops}
                    displayVehicles={displayVehicles || null}
                    stopsData={stopsData}
                    labelData={labelData}
                    routeShapeData={routeShapeData}
                    userLocation={state.userLocation}
                    selectedVehicleFeature={selectedVehicleFeature}
                    favoriteStops={state.favoriteStops}
                    vehiclesFilter={vehiclesFilter}
                    labelLayerId={state.labelLayerId}
                />
            </MapGL>

            <LiveStatus />
            <Search />
            <MapControls />

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
    const mapRef = useRef<MapRef>(null);

    return (
        <MapProvider mapRef={mapRef}>
            <MapInner />
        </MapProvider>
    );
};
