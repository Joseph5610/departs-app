
import { useMemo, useCallback, memo } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import type { FilterSpecification, SymbolLayerSpecification } from 'maplibre-gl';
import { useTheme } from 'next-themes';
import type { StopCollection, StopProperties } from '@/types';
import { useMapMetadataStore } from '@/state/mapMetadataStore';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useGeolocationStore } from '@/state/geolocationStore';
import { useRouteParams } from '@/hooks/useRouteParams';
import { useVehicles } from '@/hooks/data/useVehicles';
import { useStops } from '@/hooks/data/useStops';
import { useOverlayNetworks } from '@/hooks/data/useOverlayNetworks';
import { useNetworksInView } from '@/hooks/derived/useNetworksInView';
import { groupStations, indexStops, matchesStopTypeFilter, withoutTwins, withStopModes } from '@/domain/stops';
import { memoizeLast } from '@/lib/memoize';
import { SHARED_GROUND } from '@/config/constants';
import { useRouteShape } from '@/hooks/derived/useRouteShape';
import { useMapFilters } from '@/hooks/derived/useMapFilters';
import { useSelectedVehicle } from '@/hooks/derived/useSelectedVehicle';
import { useVehicleAnimation } from '@/hooks/features/useVehicleAnimation';
import {
    stopClusters,
    stationDots,
    stationBadges,
    stationLabels,
    platformBadges,
    stopEntrances,
    stopFavorites,
    vehicleSelectedPulse,
    vehicleSelectedPoint,
    vehicleSelectedDirection,
    vehicleSelectedLabel,
    vehiclePoints,
    vehicleDirections,
    vehicleLabels,
    routeLineCasing,
    createRouteLine,
    routeStops,
    routeTerminals,
    userLocationPulse,
    userLocationPoint,
    getVehicleColorExpression,
    MAP_SOURCES,
    STATION_CLUSTER_MAX_ZOOM,
    stopBadgeImage,
    leadingModeColor,
} from '@/config/mapLayers';
import { FRONTEND_CITIES_CONFIG } from '@/config/cities';
import { modeColorsOf } from '@/lib/map/stopBadges';
import { EMPTY_FEATURE_COLLECTION } from '@/lib/geojson';
import { safeHexColor } from '@/lib/color';

interface MapLayersProps {
    /** Whether the map instance has finished loading its style and assets */
    mapLoaded: boolean;
}

const platformGrid = memoizeLast((stops: StopCollection | null) => indexStops(stops, SHARED_GROUND.TWIN_STOP_RADIUS_M));
const stationGrid = memoizeLast((stations: StopCollection | null) => indexStops(stations, SHARED_GROUND.TWIN_STATION_RADIUS_M));
const overlayStations = memoizeLast(groupStations);
const platformModes = memoizeLast(withStopModes);
const CITY_SLUGS = Object.keys(FRONTEND_CITIES_CONFIG);

/** A collection with a neighbouring network's features appended; the collection itself when there are none. */
function withOverlay<T extends { features: unknown[] }>(own: T | null | undefined, overlay: T | null): T | null {
    if (!overlay?.features.length) return own ?? null;
    return own ? { ...own, features: [...own.features, ...overlay.features] } : overlay;
}

/**
 * This component is responsible for rendering all MapLibre sources and layers.
 * It is isolated from the main Map UI to ensure that map style updates are decoupled
 * from UI state changes (like opening sidebars or settings).
 *
 * PERFORMANCE: It subscribes to the map data itself, so live data updates re-render only this subtree,
 * and memo keeps parent re-renders out.
 */
export const MapLayers = memo(({ mapLoaded }: MapLayersProps) => {
    const showVehicles = usePreferencesStore(s => s.showVehicles);
    const showStops = usePreferencesStore(s => s.showStops);
    const showStopLabels = usePreferencesStore(s => s.showStopLabels);
    const stopTypeFilter = usePreferencesStore(s => s.stopTypeFilter);
    const favoriteStops = usePreferencesStore(s => s.favoriteStops);
    const colorVehiclesByDelay = usePreferencesStore(s => s.colorVehiclesByDelay);
    const delayFilter = usePreferencesStore(s => s.delayFilter);
    const userLocation = useGeolocationStore(s => s.userLocation);
    const selectedCity = usePreferencesStore(s => s.selectedCity);
    const badgeImage = useMemo(() => stopBadgeImage(selectedCity), [selectedCity]);
    const dotColor = useMemo(() => leadingModeColor(selectedCity, modeColorsOf, CITY_SLUGS), [selectedCity]);

    const { tripId, vehicleId } = useRouteParams();
    const { vehicles: ownVehicles } = useVehicles();
    const { stops: ownStops, stations: ownStations } = useStops();
    const networksInView = useNetworksInView();
    const overlay = useOverlayNetworks(networksInView);
    const displayVehicles = useMemo(() => withOverlay(ownVehicles, overlay.vehicles), [ownVehicles, overlay.vehicles]);
    // Where another network's stop stands on one of the selected network's, only the selected one is drawn.
    const stopsData = useMemo(
        () => platformModes(withOverlay(ownStops, withoutTwins(overlay.stops, platformGrid(ownStops ?? null), false))),
        [ownStops, overlay.stops]);
    const stationsData = useMemo(
        () => withOverlay(ownStations, withoutTwins(overlayStations(overlay.stops), stationGrid(ownStations ?? null), true)),
        [ownStations, overlay.stops]);
    const routeShapeData = useRouteShape();
    const selectedVehicle = useSelectedVehicle();
    const { selectedVehicleFeature, vehiclesFilter } = useMapFilters(selectedVehicle, tripId || vehicleId, delayFilter);

    const passesStopFilter = useCallback((props: StopProperties | null) => matchesStopTypeFilter(props, stopTypeFilter), [stopTypeFilter]);

    const { resolvedTheme } = useTheme();
    const haloColor = resolvedTheme === 'dark' ? '#111111' : '#ffffff';
    const textColor = resolvedTheme === 'dark' ? '#bdbdbd' : '#111111';

    const routeColor = safeHexColor(routeShapeData?.features[0]?.properties?.route_color as string | undefined);
    const routeLine = useMemo(() => createRouteLine(routeColor, resolvedTheme === 'light' ? 'light' : 'dark'), [routeColor, resolvedTheme]);

    const mapRef = useMapMetadataStore(s => s.mapRef);
    const { displayGeoJSON, selectedGeoJSON } = useVehicleAnimation(
        mapRef,
        mapLoaded,
        displayVehicles ?? null,
        selectedVehicleFeature,
        showVehicles
    );

    const vehicleColorExpr = useMemo(
        () => getVehicleColorExpression(colorVehiclesByDelay),
        [colorVehiclesByDelay]
    );

    const filterGeoJSON = useCallback((data: StopCollection | null, isEnabled: boolean) => {
        if (!isEnabled || !data) return EMPTY_FEATURE_COLLECTION;
        if (stopTypeFilter.length === 0) return data;
        return {
            ...data,
            features: data.features.filter(f => passesStopFilter(f.properties))
        };
    }, [stopTypeFilter, passesStopFilter]);

    const filteredStationsData = useMemo(() =>
        filterGeoJSON(stationsData, showStops),
        [stationsData, showStops, filterGeoJSON]
    );
    const stationText = showStopLabels ? stationBadges.layout?.['text-field'] : '';

    const filteredStopsData = useMemo(() => 
        filterGeoJSON(stopsData, showStops), 
        [stopsData, showStops, filterGeoJSON]
    );

    // Memoized: react-map-gl re-sends a source to the map worker whenever its `data` identity changes.
    const userLocationData = useMemo(() => userLocation ? {
        type: 'FeatureCollection' as const,
        features: [{
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: userLocation },
            properties: {}
        }]
    } : EMPTY_FEATURE_COLLECTION, [userLocation]);

    if (!mapLoaded) return null;

    return (
        <>
            <Source id={MAP_SOURCES.ROUTE_SHAPE} type="geojson" data={routeShapeData || EMPTY_FEATURE_COLLECTION}>
                <Layer
                    {...routeLineCasing}
                />
                <Layer
                    {...routeLine}
                />
                <Layer
                    {...routeStops}
                />
                <Layer
                    {...routeTerminals}
                />
            </Source>

            <Source id={MAP_SOURCES.USER_LOCATION} type="geojson" data={userLocationData}>
                <Layer {...userLocationPulse} />
                <Layer {...userLocationPoint} />
            </Source>

            <Source id={MAP_SOURCES.SELECTED_VEHICLE} type="geojson" data={selectedGeoJSON}>
                <Layer {...vehicleSelectedPulse} paint={{ ...vehicleSelectedPulse.paint, 'circle-color': vehicleColorExpr }} />
                <Layer {...vehicleSelectedPoint} paint={{ ...vehicleSelectedPoint.paint, 'circle-color': vehicleColorExpr }} />
                <Layer {...vehicleSelectedDirection} paint={{ ...vehicleSelectedDirection.paint, 'icon-color': vehicleColorExpr }} />
                <Layer {...vehicleSelectedLabel} paint={{ ...vehicleSelectedLabel.paint, 'text-color': textColor, 'text-halo-color': haloColor }} />
            </Source>

            <Source id={MAP_SOURCES.VEHICLES} type="geojson" data={showVehicles ? displayGeoJSON : EMPTY_FEATURE_COLLECTION}>
                <Layer {...vehiclePoints} filter={vehiclesFilter} paint={{ ...vehiclePoints.paint, 'circle-color': vehicleColorExpr }} />
                <Layer {...vehicleDirections} filter={vehiclesFilter} paint={{ ...vehicleDirections.paint, 'icon-color': vehicleColorExpr }} />
                <Layer {...vehicleLabels} filter={vehiclesFilter} paint={{ ...(vehicleLabels.paint as SymbolLayerSpecification['paint']), 'text-color': textColor, 'text-halo-color': haloColor }} />
            </Source>

            <Source
                id={MAP_SOURCES.STATIONS}
                type="geojson"
                data={filteredStationsData}
                cluster={true}
                clusterMaxZoom={STATION_CLUSTER_MAX_ZOOM}
                clusterRadius={25}
            >
                <Layer {...stopClusters} />
                <Layer {...stationDots} paint={{ ...stationDots.paint, 'circle-color': dotColor }} />
                <Layer
                    {...stationBadges}
                    layout={{ ...stationBadges.layout, 'icon-image': badgeImage, 'text-field': stationText }}
                    paint={{ ...stationBadges.paint, 'text-color': textColor, 'text-halo-color': haloColor }}
                />
                {showStopLabels && <Layer {...stationLabels} paint={{ ...stationLabels.paint, 'text-color': textColor, 'text-halo-color': haloColor }} />}
            </Source>

            <Source id={MAP_SOURCES.STOPS} type="geojson" data={filteredStopsData}>
                <Layer {...stopEntrances} paint={{ ...(stopEntrances.paint as SymbolLayerSpecification['paint']), 'text-halo-color': haloColor }} />
                <Layer {...platformBadges} layout={{ ...platformBadges.layout, 'icon-image': badgeImage }} paint={{ ...platformBadges.paint, 'text-color': textColor, 'text-halo-color': haloColor }} />
                {favoriteStops.length > 0 && (
                    <Layer
                        {...stopFavorites}
                        paint={{ ...(stopFavorites.paint as SymbolLayerSpecification['paint']), 'icon-halo-color': haloColor }}
                        filter={['in', ['get', 'stop_id'], ['literal', favoriteStops]] as FilterSpecification}
                    />
                )}
            </Source>
        </>
    );
});

MapLayers.displayName = 'MapLayers';
