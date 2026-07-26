import React, { useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import { navigate } from 'wouter/use-browser-location';
import { useLocation } from 'wouter';

import MapGL, { Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Helmet } from 'react-helmet-async';
import { MapPin } from 'lucide-react';
import { DetailPanel } from '../DetailPanel/DetailPanel';
import { DepartureBoardHeader } from '../DetailPanel/DepartureBoard/DepartureBoardHeader';
import { FavoritesPanel } from '../DetailPanel/FavoritesPanel/FavoritesPanel';
import { LiveStatus } from './LiveStatus';
import { getInitialViewState } from '../../utils/mapUtils';
import { MapLayers } from './MapLayers';
import { MapController } from './MapController';
import { useMapEvents } from '../../hooks/features/useMapEvents';
import { useViewportStore } from '../../state/viewportStore';
import { useSelectionStore } from '../../state/selectionStore';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useRouteParams } from '../../hooks/useRouteParams';
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
import { FeedbackModal } from '../Modals/FeedbackModal/FeedbackModal';
import { StatsPanel } from './Stats/StatsPanel';
import { StatsTabs } from './Stats/StatsTabs';

const MAP_STYLES = {
    dark: {
        nolabels: 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json',
        labels: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    },
    light: {
        nolabels: 'https://basemaps.cartocdn.com/gl/voyager-nolabels-gl-style/style.json',
        labels: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    }
};

/**
 * MapInner Component
 *
 * Manages the layout of the map and its overlays.
 */
const MapInner: React.FC = () => {
    const { t } = useTranslation();
    const mapEvents = useMapEvents();

    // Store Actions
    const { stopId: selectedStopId, tripId, vehicleId } = useRouteParams();
    const selectedId = tripId || vehicleId;

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
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const { resolvedTheme } = useTheme();

    // Derived State
    const { isStatsRoute, isFavoritesRoute } = useRouteParams();
    const selectedStop = useSelectedStop();
    const selectedVehicle = useSelectedVehicle();

    // Data Hooks
    const { vehicles: displayVehicles } = useVehicles();
    const { stops: stopsData, centroids: labelData } = useStops();
    const routeShapeData = useRouteShape();

    const initialViewState = useMemo(() => getInitialViewState(), []);

    const { selectedVehicleFeature, vehiclesFilter } = useMapFilters(selectedVehicle, selectedId);

    const [location] = useLocation();
    const returnPath = useSelectionStore(s => s.returnPath);
    const setReturnPath = useSelectionStore(s => s.actions.setReturnPath);
    const setIsFollowing = useSelectionStore(s => s.actions.setIsFollowing);

    useEffect(() => {
        if (!location.includes('/trip/')) {
            setReturnPath(location);
        }
    }, [location, setReturnPath]);

    const handleBack = useCallback(() => {
        if (returnPath && returnPath !== location) {
            navigate(returnPath);
        } else {
            navigate(`/${selectedCity}`);
        }
    }, [returnPath, location, selectedCity]);

    const isRootPath = returnPath === `/${selectedCity}` || returnPath === `/${selectedCity}/` || returnPath === '/';
    const shouldShowBackButton = Boolean(
        selectedVehicle && 
        returnPath && 
        returnPath !== location && 
        !isRootPath
    );

    const panelTitle = useMemo(() => {
        if (selectedVehicle) {
            return t('map.vehicleDetails.lineLabel', { line: selectedVehicle.route_short_name });
        }
        if (selectedStop) {
            return selectedStop.stop_name;
        }
        return '';
    }, [selectedVehicle, selectedStop, t]);

    const displayTitle = panelTitle ? `${panelTitle} - departs.app` : 'departs.app — MHD Praha & Brno LIVE';
    const canonicalUrl = typeof window !== 'undefined' ? window.location.href.split('?')[0] : 'https://departs.app/';

    const jsonLd = useMemo(() => {
        if (selectedStop) {
            return {
                "@context": "https://schema.org",
                "@type": "TransitStop",
                "name": selectedStop.stop_name,
                "url": canonicalUrl,
                "geo": selectedStop.coordinates ? {
                    "@type": "GeoCoordinates",
                    "latitude": selectedStop.coordinates[1],
                    "longitude": selectedStop.coordinates[0]
                } : undefined
            };
        }
        return {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "departs.app",
            "url": "https://departs.app",
            "description": "Real-time visualization of public transport for Prague and Brno. Track buses, trams, and metro live.",
            "applicationCategory": "TransportApplication",
            "operatingSystem": "All",
            "image": "https://departs.app/icon.png",
            "author": {
                "@type": "Organization",
                "name": "departs.app"
            }
        };
    }, [selectedStop, canonicalUrl]);

    return (
        <>
            <Helmet>
                <title>{displayTitle}</title>
                <link rel="canonical" href={canonicalUrl} />
                <script type="application/ld+json">
                    {JSON.stringify(jsonLd)}
                </script>
            </Helmet>
            <MapGL
                ref={mapRef}
                initialViewState={initialViewState}
                mapStyle={MAP_STYLES[(resolvedTheme as 'dark' | 'light') ?? 'dark'][mapBaseStyle]}
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
                        navigate(`/${selectedCity}`); // Close panel on background click
                        return;
                    }

                    if (f.layer.id === 'clusters') {
                        const clusterId = f.properties?.cluster_id;
                        const map = mapRef.current?.getMap();
                        if (!map) {
                            return;
                        }
                        const sourceId = 'city-stops';
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
                        if (!props?.vehicle_id || !props?.gtfs_trip_id) {
                            return;
                        }
                        setIsFollowing(true);
                        const tId = props.gtfs_trip_id;
                        const vId = props.vehicle_id;
                        if (vId && vId !== tId) {
                            navigate(`/${selectedCity}/trip/${encodeURIComponent(tId)}/${encodeURIComponent(vId)}`);
                        } else {
                            navigate(`/${selectedCity}/trip/${encodeURIComponent(tId)}`);
                        }
                        return;
                    }

                    if (f.layer.id === 'unclustered-point' || f.layer.id === 'station-icons' || f.layer.id === 'transfer-outer' || f.layer.id === 'transfer-inner') {
                        const stopId = f.properties?.stop_id;
                        if (stopId) {
                            navigate(`/${selectedCity}/stop/${encodeURIComponent(stopId)}`);
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
            <MapControls />

            <WelcomeModal />
            <SettingsModal />
            <AlertsModal />
            <FeedbackModal />
            <DetailPanel
                isOpen={isFavoritesRoute || isStatsRoute || !!selectedStop || !!selectedVehicle}
                id={isStatsRoute ? 'stats' : isFavoritesRoute ? 'favorites' : (selectedId || selectedStopId || undefined)}
                onClose={() => {
                    navigate(`/${selectedCity}`);
                }}
                onBack={shouldShowBackButton ? handleBack : undefined}
                title={
                    isStatsRoute ? t('stats.title') :
                    isFavoritesRoute ? t('favorites.title') :
                    panelTitle
                }
                platformCode={(!isStatsRoute && !isFavoritesRoute && !selectedVehicle) ? selectedStop?.platform_code : undefined}
                subHeader={isStatsRoute ? <StatsTabs /> : (!isStatsRoute && !isFavoritesRoute) ? <DepartureBoardHeader /> : undefined}
            >
                {isStatsRoute ? (
                    <StatsPanel />
                ) : isFavoritesRoute ? (
                    <FavoritesPanel />
                ) : (
                    <DetailPanelContent />
                )}
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
