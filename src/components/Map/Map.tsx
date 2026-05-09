import React, { useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import MapGL, { Marker, type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin } from 'lucide-react';
import { DetailPanel } from '../DetailPanel/DetailPanel';
import { DepartureBoardHeader } from '../DetailPanel/DepartureBoard/DepartureBoardHeader';
import { LiveStatus } from './LiveStatus';
import { getInitialViewState } from '../../utils/mapUtils';
import { MapLayers } from './MapLayers';
import { MapStateProvider } from '../../state/MapStateProvider';
import { useSelection, useViewport, usePreferences } from '../../state/contexts';
import { MapControls } from './MapControls';
import { DetailPanelContent } from '../DetailPanel/DetailPanelContent';
import { useVehicles } from '../../hooks/data/useVehicles';
import { useStops } from '../../hooks/data/useStops';
import { useRouteShape } from '../../hooks/derived/useRouteShape';
import { useMapFilters } from '../../hooks/derived/useMapFilters';
import { useSelectedStop } from '../../hooks/derived/useSelectedStop';
import { useSelectedVehicle } from '../../hooks/derived/useSelectedVehicle';
import { Search } from './Search/Search';
import { SettingsModal } from '../Modals/SettingsModal/SettingsModal';
import { WelcomeModal } from '../Modals/WelcomeModal';
import { AlertsModal } from '../Modals/AlertsModal';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json';

/**
 * MapInner Component
 *
 * Consumes MapContext and manages the layout of the map and its overlays.
 */
const MapInner: React.FC = () => {
    const { t } = useTranslation();
    const { state: selState, actions: selActions } = useSelection();
    const { state: vpState, mapEvents, mapRef, mapLoaded, labelLayerId, userLocation } = useViewport();
    const { state: { showVehicles, showStops, showStopLabels, stopTypeFilter, favoriteStops } } = usePreferences();

    const { selectedId } = selState;

    // Derived State
    const selectedStop = useSelectedStop();
    const selectedVehicle = useSelectedVehicle();

    // Data Hooks
    const { vehicles: displayVehicles } = useVehicles();
    const { stops: stopsData, centroids: labelData } = useStops();
    const routeShapeData = useRouteShape();

    const initialViewState = useMemo(() => getInitialViewState(), []);

    const { selectedVehicleFeature, vehiclesFilter } = useMapFilters(selectedVehicle, selectedId);

    const handleBack = useCallback(() => {
        if (selectedVehicle && selectedStop) {
            selActions.selectStop(selectedStop.stop_id);
        }
    }, [selectedVehicle, selectedStop, selActions]);

    const panelTitle = useMemo(() => {
        if (selectedVehicle) {
            return t('map.vehicleDetails.lineLabel', { line: selectedVehicle.route_short_name });
        }
        if (selectedStop) {
            return selectedStop.stop_name;
        }
        return '';
    }, [selectedVehicle, selectedStop, t]);

    return (
        <>
            <MapGL
                ref={mapRef}
                initialViewState={initialViewState}
                mapStyle={MAP_STYLE}
                onMove={mapEvents.onMove}
                onMoveEnd={mapEvents.onMoveEnd}
                onLoad={mapEvents.onLoad}
                style={{ width: '100%', height: '100%', pointerEvents: 'auto' }}
                onDragStart={mapEvents.onDragStart}
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
                    if (!f || f.layer.id === 'entrance-layer') {
                        return;
                    }

                    if (f.layer.id === 'clusters') {
                        const clusterId = f.properties?.cluster_id;
                        const map = mapRef.current?.getMap();
                        if (!map) {
                            return;
                        }
                        const sourceId = 'pid-stops';
                        const source = map.getSource(sourceId) as maplibregl.GeoJSONSource;
                        if (source && clusterId !== undefined) {
                            source.getClusterExpansionZoom(clusterId).then((zoom) => {
                                mapRef.current?.easeTo({
                                    center: (f.geometry as { type: 'Point'; coordinates: [number, number] }).coordinates,
                                    zoom,
                                    duration: 500
                                });
                            }).catch(() => { });
                        }
                        return;
                    }

                    if (f.layer.id === 'vehicles-point' || f.layer.id === 'vehicles-direction-all' || f.layer.id === 'vehicles-label-all') {
                        const props = f.properties;
                        if (!props?.vehicle_id) {
                            return;
                        }
                        selActions.selectVehicle(props.gtfs_trip_id, props.vehicle_id, false);
                        return;
                    }

                    if (f.layer.id === 'unclustered-point' || f.layer.id === 'station-icons' || f.layer.id === 'transfer-outer' || f.layer.id === 'transfer-inner') {
                        const stopId = f.properties?.stop_id;
                        if (stopId) {
                            selActions.selectStop(stopId);
                        }
                    }
                }}
                interactiveLayerIds={['unclustered-point', 'station-icons', 'transfer-outer', 'transfer-inner', 'clusters', 'vehicles-point', 'vehicles-direction-all', 'vehicles-label-all']}
            >
                <MapLayers
                    mapLoaded={mapLoaded}
                    showVehicles={showVehicles}
                    showStops={showStops}
                    showStopLabels={showStopLabels}
                    stopTypeFilter={stopTypeFilter}
                    displayVehicles={displayVehicles || null}
                    stopsData={stopsData}
                    labelData={labelData}
                    routeShapeData={routeShapeData}
                    userLocation={userLocation}
                    selectedVehicleFeature={selectedVehicleFeature}
                    favoriteStops={favoriteStops}
                    vehiclesFilter={vehiclesFilter}
                    labelLayerId={labelLayerId}
                />
                
                {vpState.selectedPlace && (
                    <Marker
                        longitude={vpState.selectedPlace.coordinates[0]}
                        latitude={vpState.selectedPlace.coordinates[1]}
                        anchor="bottom"
                    >
                        <div className="flex flex-col items-center">
                            <div className="bg-primary text-primary-foreground px-2 py-0.5 rounded-md text-sm font-bold shadow-md whitespace-nowrap mb-1">
                                {vpState.selectedPlace.name}
                            </div>
                            <div className="text-primary drop-shadow-md">
                                <MapPin size={32} fill="currentColor" className="text-primary" />
                            </div>
                        </div>
                    </Marker>
                )}
            </MapGL>

            <LiveStatus />
            <Search />
            <MapControls />

            <WelcomeModal />
            <SettingsModal />
            <AlertsModal />

            <DetailPanel
                isOpen={!!selectedStop || !!selectedVehicle}
                id={selectedId || selectedStop?.stop_id || undefined}
                onClose={() => selActions.clearSelection()}
                onBack={(selectedVehicle && selectedStop) ? handleBack : undefined}
                title={panelTitle}
                platformCode={!selectedVehicle ? selectedStop?.platform_code : undefined}
                subHeader={<DepartureBoardHeader />}
            >
                <DetailPanelContent />
            </DetailPanel>
        </>
    );
};

/**
 * Map Component (Entry Point)
 */
export const Map: React.FC = () => {
    const mapRef = useRef<MapRef>(null);

    return (
        <MapStateProvider mapRef={mapRef}>
            <MapInner />
        </MapStateProvider>
    );
};
