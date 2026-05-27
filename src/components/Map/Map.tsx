import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import MapGL, { Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin } from 'lucide-react';
import { DetailPanel } from '../DetailPanel/DetailPanel';
import { DepartureBoardHeader } from '../DetailPanel/DepartureBoard/DepartureBoardHeader';
import { FavoritesPanel } from '../DetailPanel/FavoritesPanel/FavoritesPanel';
import { LiveStatus } from './LiveStatus';
import { getInitialViewState } from '../../utils/mapUtils';
import { MapLayers } from './MapLayers';
import { MapController, useMapEvents } from './MapController';
import { useSelectionStore, getSelectedId } from '../../state/selectionStore';
import { useViewportStore } from '../../state/viewportStore';
import { usePreferencesStore } from '../../state/preferencesStore';
import { geocodingCache } from '../../hooks/data/useGeocoding';
import { useMapMetadataStore } from '../../state/mapMetadataStore';
import { useGeolocationStore } from '../../state/geolocationStore';
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

const MAP_STYLE_NOLABELS = 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json';
const MAP_STYLE_LABELS = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

/**
 * MapInner Component
 *
 * Manages the layout of the map and its overlays.
 */
const MapInner: React.FC = () => {
    const { t } = useTranslation();
    const mapEvents = useMapEvents();

    // Selection Store
    const selectedId = useSelectionStore(getSelectedId);
    const selectedStopId = useSelectionStore(s => s.selectedStopId);
    const selActions = useSelectionStore(s => s.actions);

    // Viewport Store
    const selectedPlaceId = useViewportStore(s => s.selectedPlaceId);
    const selectedPlace = selectedPlaceId ? geocodingCache.get(selectedPlaceId) : null;

    // Metadata Store
    const mapRef = useMapMetadataStore(s => s.mapRef);
    const mapLoaded = useMapMetadataStore(s => s.mapLoaded);
    const labelLayerId = useMapMetadataStore(s => s.labelLayerId);

    // Geolocation Store
    const userLocation = useGeolocationStore(s => s.userLocation);

    // Preferences Store
    const showVehicles = usePreferencesStore(s => s.showVehicles);
    const showStops = usePreferencesStore(s => s.showStops);
    const showStopLabels = usePreferencesStore(s => s.showStopLabels);
    const stopTypeFilter = usePreferencesStore(s => s.stopTypeFilter);
    const favoriteStops = usePreferencesStore(s => s.favoriteStops);
    const mapBaseStyle = usePreferencesStore(s => s.mapBaseStyle);

    // Derived State
    const selectedStop = useSelectedStop();
    const selectedVehicle = useSelectedVehicle();

    const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);

    useEffect(() => {
        if (selectedStop || selectedVehicle) {
            const timer = setTimeout(() => {
                setIsFavoritesOpen(false);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [selectedStop, selectedVehicle]);

    const handleToggleFavorites = useCallback(() => {
        setIsFavoritesOpen(prev => {
            const next = !prev;
            if (next) {
                setTimeout(() => {
                    selActions.clearSelection();
                }, 0);
            }
            return next;
        });
    }, [selActions]);

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
                mapStyle={mapBaseStyle === 'labels' ? MAP_STYLE_LABELS : MAP_STYLE_NOLABELS}
                onMove={mapEvents?.onMove}
                onMoveEnd={mapEvents?.onMoveEnd}
                onLoad={mapEvents?.onLoad}
                style={{ width: '100%', height: '100%', pointerEvents: 'auto' }}
                onDragStart={mapEvents?.onDragStart}
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
                            }).catch((e) => { console.error('Failed to load map icon:', e); });
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
                
                {selectedPlace && (
                    <Marker
                        longitude={selectedPlace.coordinates[0]}
                        latitude={selectedPlace.coordinates[1]}
                        anchor="bottom"
                    >
                        <div className="flex flex-col items-center">
                            <div className="bg-primary text-primary-foreground px-2 py-0.5 rounded-md text-sm font-bold shadow-md whitespace-nowrap mb-1">
                                {selectedPlace.name}
                            </div>
                            <div className="text-primary drop-shadow-md">
                                <MapPin size={24} fill="currentColor" className="text-primary"  strokeWidth={1.5} />
                            </div>
                        </div>
                    </Marker>
                )}
            </MapGL>

            <LiveStatus />
            <Search />
            <MapControls
                onToggleFavorites={handleToggleFavorites}
                isFavoritesActive={isFavoritesOpen}
            />

            <WelcomeModal />
            <SettingsModal />
            <AlertsModal />

            <DetailPanel
                isOpen={isFavoritesOpen}
                id="favorites"
                onClose={() => setIsFavoritesOpen(false)}
                title={t('favorites.title')}
            >
                <FavoritesPanel />
            </DetailPanel>

            <DetailPanel
                isOpen={!!selectedStop || !!selectedVehicle}
                id={selectedId || selectedStopId || undefined}
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
    return (
        <MapController>
            <MapInner />
        </MapController>
    );
};
