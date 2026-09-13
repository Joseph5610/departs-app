import React, { lazy, Suspense, useMemo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import { navigate } from 'wouter/use-browser-location';
import { paths } from '../../lib/routes';
import { useLocation } from 'wouter';

import MapGL, { Marker } from 'react-map-gl/maplibre';
import type { GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../../lib/maplibre-worker';
import { Helmet } from 'react-helmet-async';
import { MapPin } from 'lucide-react';
import { DetailPanel } from '../DetailPanel/DetailPanel';
import { DepartureBoardHeader } from '../DetailPanel/DepartureBoard/DepartureBoardHeader';
import { PointOfSaleHeader } from '../DetailPanel/PointOfSaleHeader';
import { FavoritesPanel } from '../DetailPanel/FavoritesPanel/FavoritesPanel';
import { LiveStatus } from './LiveStatus';
import { getInitialViewState } from '../../utils/mapUtils';
import { EXTERNAL_URLS, MAP_CAMERA, SITE_TITLE, SITE_URL } from '../../config/constants';
import { MapLayers } from './MapLayers';
import { MAP_LAYERS, MAP_SOURCES, STOP_CLICK_LAYERS, VEHICLE_CLICK_LAYERS, INTERACTIVE_LAYER_IDS } from '../../config/mapLayers';
import { MapController } from './MapController';
import { useMapEvents } from '../../hooks/features/useMapEvents';
import { useViewportStore } from '../../state/viewportStore';
import { useSelectionStore } from '../../state/selectionStore';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useUiStore } from '../../state/uiStore';
import { useRouteParams } from '../../hooks/useRouteParams';
import { useRememberedPlace } from '../../hooks/data/useGeocoding';
import { useMapMetadataStore } from '../../state/mapMetadataStore';
import { MapControls } from './MapControls';
import { PointsOfSaleLayer } from './PointsOfSaleLayer';
import { DetailPanelContent } from '../DetailPanel/DetailPanelContent';
import { StopTitle } from '../DetailPanel/DepartureBoard/StopTitle';
import { usePointsOfSale } from '../../hooks/data/usePointsOfSale';
import type { PointOfSale } from '../../types/pointsOfSale';
import { useSelectedStop } from '../../hooks/derived/useSelectedStop';
import { useSelectedVehicle } from '../../hooks/derived/useSelectedVehicle';
import { Search } from './Search/Search';
import { MountWhenOpened } from '../MountWhenOpened';
import { McpPromoBanner } from '../McpPromo/McpPromoBanner';

const SettingsModal = lazy(() => import('../Modals/SettingsModal/SettingsModal').then(m => ({ default: m.SettingsModal })));
const WelcomeModal = lazy(() => import('../Modals/WelcomeModal').then(m => ({ default: m.WelcomeModal })));
const AlertsModal = lazy(() => import('../Modals/AlertsModal').then(m => ({ default: m.AlertsModal })));
const FeedbackModal = lazy(() => import('../Modals/FeedbackModal/FeedbackModal').then(m => ({ default: m.FeedbackModal })));
const StatsPanel = lazy(() => import('./Stats/StatsPanel').then(m => ({ default: m.StatsPanel })));
const McpModal = lazy(() => import('../Modals/McpModal/McpModal').then(m => ({ default: m.McpModal })));
import { StatsTabs } from './Stats/StatsTabs';

/**
 * MapInner Component
 *
 * Manages the layout of the map and its overlays.
 */
const MapInner: React.FC = () => {
    const { t } = useTranslation();
    const mapEvents = useMapEvents();

    // Store Actions
    const { stopId: selectedStopId, tripId, vehicleId, isStatsRoute, isFavoritesRoute, posId } = useRouteParams();
    const selectedId = tripId || vehicleId;

    // Viewport Store
    const selectedPlaceId = useViewportStore(s => s.selectedPlaceId);
    const selectedPlace = useRememberedPlace(selectedPlaceId);

    // Metadata Store
    const mapRef = useMapMetadataStore(s => s.mapRef);
    const mapLoaded = useMapMetadataStore(s => s.mapLoaded);

    // Preferences Store
    const mapBaseStyle = usePreferencesStore(s => s.mapBaseStyle);
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const hasSeenWelcome = usePreferencesStore(s => s.hasSeenWelcome);
    // Read once: a first-time visitor gets the welcome modal, and the MCP promo only from the next visit.
    const [isReturningVisitor] = useState(() => usePreferencesStore.getState().hasSeenWelcome);
    const isSettingsOpen = useUiStore(s => s.isSettingsOpen);
    const isAlertsOpen = useUiStore(s => s.isAlertsOpen);
    const isFeedbackOpen = useUiStore(s => s.isFeedbackOpen);
    const isMcpModalOpen = useUiStore(s => s.isMcpModalOpen);
    const { resolvedTheme } = useTheme();

    // Derived State
    const selectedStop = useSelectedStop();
    const selectedVehicle = useSelectedVehicle();

    // PoS Data
    const { data: posList } = usePointsOfSale();
    const selectedPos = useMemo(() => posId ? posList?.find((p: PointOfSale) => p.id === posId) : null, [posId, posList]);

    const initialViewState = useMemo(() => getInitialViewState(), []);


    const [location] = useLocation();
    const returnPath = useSelectionStore(s => s.returnPath);
    const setReturnPath = useSelectionStore(s => s.actions.setReturnPath);
    const setIsFollowing = useSelectionStore(s => s.actions.setIsFollowing);

    const prevLocationRef = React.useRef(location);

    useEffect(() => {
        if (prevLocationRef.current !== location) {
            setReturnPath(prevLocationRef.current);
            prevLocationRef.current = location;
        }
    }, [location, setReturnPath]);

    const handleBack = useCallback(() => {
        if (returnPath && returnPath !== location) {
            navigate(returnPath);
        } else {
            navigate(paths.city(selectedCity));
        }
    }, [returnPath, location, selectedCity]);

    const closePanel = useCallback(() => navigate(paths.city(selectedCity)), [selectedCity]);

    const isRootPath = !returnPath || returnPath === paths.city(selectedCity) || returnPath === `${paths.city(selectedCity)}/` || returnPath === '/';
    const hasActiveDetailPanel = Boolean(selectedVehicle || selectedStop || selectedPos);
    const shouldShowBackButton = hasActiveDetailPanel && returnPath !== null && returnPath !== location && !isRootPath;

    const panelTitle = useMemo(() => {
        if (selectedVehicle) {
            return t('map.vehicleDetails.lineLabel', { line: selectedVehicle.route_short_name });
        }
        if (selectedStop) {
            return selectedStop.stop_name;
        }
        if (selectedPos) {
            return t('pos.title');
        }
        return '';
    }, [selectedVehicle, selectedStop, selectedPos, t]);

    // Stable elements, so the memoized DetailPanel skips re-rendering on every vehicle poll.
    const detailTitle = useMemo(() => (
        isStatsRoute ? t('stats.title') :
        isFavoritesRoute ? t('favorites.title') :
        (selectedStop ? <StopTitle title={panelTitle} /> : panelTitle)
    ), [isStatsRoute, isFavoritesRoute, selectedStop, panelTitle, t]);

    const detailSubHeader = useMemo(() => (
        isStatsRoute ? <StatsTabs /> :
        selectedPos ? <PointOfSaleHeader pos={selectedPos} /> :
        (!isFavoritesRoute ? <DepartureBoardHeader /> : undefined)
    ), [isStatsRoute, isFavoritesRoute, selectedPos]);

    const detailContent = useMemo(() => (
        isStatsRoute ? <Suspense fallback={null}><StatsPanel /></Suspense> : isFavoritesRoute ? <FavoritesPanel /> : <DetailPanelContent />
    ), [isStatsRoute, isFavoritesRoute]);

    const displayTitle = panelTitle ? `${panelTitle} - departs.app` : SITE_TITLE;
    const canonicalUrl = typeof window !== 'undefined' ? window.location.href.split('?')[0] : `${SITE_URL}/`;

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
            "url": SITE_URL,
            "description": "Real-time visualization of public transport for Prague, Brno and Prešov. Track buses, trams, and metro live.",
            "applicationCategory": "TransportApplication",
            "operatingSystem": "All",
            "image": `${SITE_URL}/icon.png`,
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
                mapStyle={EXTERNAL_URLS.MAP_STYLES[(resolvedTheme as 'dark' | 'light') ?? 'dark'][mapBaseStyle]}
                onMove={mapEvents?.onMove}
                onMoveEnd={mapEvents?.onMoveEnd}
                onLoad={mapEvents?.onLoad}
                style={{ width: '100%', height: '100%', pointerEvents: 'auto' }}
                onDragStart={mapEvents?.onDragStart}
                onMouseEnter={(evt) => {
                    const features = evt.features;
                    if (features?.length && features[0].layer.id !== MAP_LAYERS.STOP_ENTRANCES) {
                        evt.target.getCanvas().style.cursor = 'pointer';
                    }
                }}
                onMouseLeave={(evt) => {
                    evt.target.getCanvas().style.cursor = '';
                }}
                onClick={(evt) => {
                    const f = evt.features?.[0];
                    if (!f || f.layer.id === MAP_LAYERS.STOP_ENTRANCES) {
                        navigate(paths.city(selectedCity)); // Close panel on background click
                        return;
                    }

                    if (f.layer.id === MAP_LAYERS.STOP_CLUSTERS) {
                        const clusterId = f.properties?.cluster_id;
                        const map = mapRef.current?.getMap();
                        if (!map) {
                            return;
                        }
                        const source = map.getSource(MAP_SOURCES.STOPS) as GeoJSONSource;
                        if (source && clusterId !== undefined) {
                            source.getClusterExpansionZoom(clusterId).then((zoom) => {
                                mapRef.current?.easeTo({
                                    center: (f.geometry as { type: 'Point'; coordinates: [number, number] }).coordinates,
                                    zoom,
                                    duration: MAP_CAMERA.CLUSTER_EXPAND_MS
                                });
                            }).catch((e) => { console.error('Failed to expand stop cluster:', e); });
                        }
                        return;
                    }

                    if (VEHICLE_CLICK_LAYERS.includes(f.layer.id)) {
                        const props = f.properties;
                        if (!props?.vehicle_id || !props?.gtfs_trip_id) {
                            return;
                        }
                        setIsFollowing(true);
                        navigate(paths.trip(selectedCity, props.gtfs_trip_id, props.vehicle_id));
                        return;
                    }

                    if (STOP_CLICK_LAYERS.includes(f.layer.id)) {
                        const stopId = f.properties?.stop_id;
                        if (stopId) {
                            navigate(paths.stop(selectedCity, stopId));
                        }
                        return;
                    }

                    if (f.layer.id === MAP_LAYERS.POINTS_OF_SALE) {
                        const id = f.properties?.id;
                        if (id) {
                            navigate(paths.pos(selectedCity, id));
                        }
                        return;
                    }
                }}
                interactiveLayerIds={INTERACTIVE_LAYER_IDS}
            >
                <PointsOfSaleLayer mapLoaded={mapLoaded} />
                <MapLayers mapLoaded={mapLoaded} />
                
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

            <MountWhenOpened when={!hasSeenWelcome}>
                <WelcomeModal />
            </MountWhenOpened>
            <MountWhenOpened when={isSettingsOpen}>
                <SettingsModal />
            </MountWhenOpened>
            <MountWhenOpened when={isAlertsOpen}>
                <AlertsModal />
            </MountWhenOpened>
            <MountWhenOpened when={isFeedbackOpen}>
                <FeedbackModal />
            </MountWhenOpened>
            <MountWhenOpened when={isMcpModalOpen}>
                <McpModal />
            </MountWhenOpened>
            {isReturningVisitor && <McpPromoBanner />}
            <DetailPanel
                isOpen={isFavoritesRoute || isStatsRoute || !!selectedStop || !!selectedVehicle || !!selectedPos}
                id={isStatsRoute ? 'stats' : isFavoritesRoute ? 'favorites' : (selectedId || selectedStopId || posId || undefined)}
                onClose={closePanel}
                onBack={shouldShowBackButton ? handleBack : undefined}
                title={detailTitle}
                platformCode={(!isStatsRoute && !isFavoritesRoute && !selectedVehicle) ? selectedStop?.platform_code : undefined}
                subHeader={detailSubHeader}
            >
                {detailContent}
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
