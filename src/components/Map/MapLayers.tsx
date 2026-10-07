
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
import { useCityConfig } from '@/hooks/data/useCities';
import { indexStops, matchesStopTypeFilter, withoutTwins, withStopColor } from '@/domain/stops';
import { memoizeLast } from '@/lib/memoize';
import { SHARED_GROUND } from '@/config/constants';
import { useRouteShape } from '@/hooks/derived/useRouteShape';
import { useMapFilters } from '@/hooks/derived/useMapFilters';
import { useSelectedVehicle } from '@/hooks/derived/useSelectedVehicle';
import { useVehicleAnimation } from '@/hooks/features/useVehicleAnimation';
import {
    stopClusters,
    stopPointsGlow,
    stopPoints,
    transferOuterPoints,
    transferInnerPoints,
    stopLabels,
    stopIcons,
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
    MAP_SOURCES
} from '@/config/mapLayers';
import { EMPTY_FEATURE_COLLECTION } from '@/lib/geojson';
import { safeHexColor } from '@/lib/color';

interface MapLayersProps {
    /** Whether the map instance has finished loading its style and assets */
    mapLoaded: boolean;
}

const platformGrid = memoizeLast((stops: StopCollection | null) => indexStops(stops, SHARED_GROUND.TWIN_STOP_RADIUS_M));
const stationGrid = memoizeLast((stations: StopCollection | null) => indexStops(stations, SHARED_GROUND.TWIN_STATION_RADIUS_M));

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

    const { tripId, vehicleId } = useRouteParams();
    const { vehicles: ownVehicles } = useVehicles();
    const { stops: ownStops, centroids: ownCentroids } = useStops();
    const networksInView = useNetworksInView();
    const overlay = useOverlayNetworks(networksInView);
    const { stopColor } = useCityConfig();
    const displayVehicles = useMemo(() => withOverlay(ownVehicles, overlay.vehicles), [ownVehicles, overlay.vehicles]);
    const ownColoredStops = useMemo(() => withStopColor(ownStops, stopColor), [ownStops, stopColor]);
    // Where another network's stop stands on one of the selected network's, only the selected one is drawn.
    const stopsData = useMemo(
        () => withOverlay(ownColoredStops, withoutTwins(overlay.stops, platformGrid(ownStops ?? null), false)),
        [ownColoredStops, ownStops, overlay.stops]);
    const labelData = useMemo(
        () => withOverlay(ownCentroids, withoutTwins(overlay.centroids, stationGrid(ownCentroids ?? null), true)),
        [ownCentroids, overlay.centroids]);
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

    const filteredLabelData = useMemo(() => 
        filterGeoJSON(labelData, showStops && showStopLabels), 
        [labelData, showStops, showStopLabels, filterGeoJSON]
    );

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

            <Source id={MAP_SOURCES.STOP_LABELS} type="geojson" data={filteredLabelData}>
                <Layer {...stopLabels} paint={{ ...(stopLabels.paint as SymbolLayerSpecification['paint']), 'text-color': textColor, 'text-halo-color': haloColor }} />
            </Source>

            <Source
                id={MAP_SOURCES.STOPS}
                type="geojson"
                data={filteredStopsData}
                cluster={true}
                clusterMaxZoom={13}
                clusterRadius={25}
            >
                <Layer {...stopEntrances} paint={{ ...(stopEntrances.paint as SymbolLayerSpecification['paint']), 'text-halo-color': haloColor }} />
                <Layer {...stopClusters} />
                <Layer {...stopPointsGlow} />
                <Layer {...stopPoints} />
                <Layer {...transferOuterPoints} />
                <Layer {...transferInnerPoints} />
                <Layer {...stopIcons} paint={{ ...(stopIcons.paint as SymbolLayerSpecification['paint']), 'text-color': textColor, 'text-halo-color': haloColor }} />
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
