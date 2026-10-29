
import { useMemo, memo } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import type { SymbolLayerSpecification } from 'maplibre-gl';
import { useTheme } from 'next-themes';
import type { Entrance, Platform, Station } from '@/types';
import { useMapMetadataStore } from '@/state/mapMetadataStore';
import { usePreferencesStore } from '@/state/preferencesStore';
import { useGeolocationStore } from '@/state/geolocationStore';
import { useRouteParams } from '@/hooks/useRouteParams';
import { useVehicles } from '@/hooks/data/useVehicles';
import { useStops } from '@/hooks/data/useStops';
import { useOverlayNetworks } from '@/hooks/data/useOverlayNetworks';
import { useNetworksInView } from '@/hooks/derived/useNetworksInView';
import { favoriteMarks, mapStopsWithOverlay, pinsByNetwork, toMapStops, type HiddenNightLinesOf } from '@/domain/stops';
import { memoizeLast } from '@/lib/memoize';
import { hasDrawnLine } from '@/domain/routes';
import { useRouteShape } from '@/hooks/derived/useRouteShape';
import { useNetworkLayer } from '@/hooks/derived/useNetworkLayer';
import { useMapFilters } from '@/hooks/derived/useMapFilters';
import { useSelectedVehicle } from '@/hooks/derived/useSelectedVehicle';
import { useHiddenNightLines } from '@/hooks/derived/useHiddenNightLines';
import { useVehicleAnimation } from '@/hooks/features/useVehicleAnimation';
import {
    stopGlows,
    stopGlowCores,
    STOP_GLOW,
    stationBadges,
    stationNames,
    platformBadges,
    stopEntrances,
    vehicleSelectedPulse,
    vehicleSelectedPoint,
    vehicleSelectedDirection,
    vehicleSelectedLabel,
    vehiclePoints,
    vehicleDirections,
    vehicleLabels,
    routeLineCasing,
    createRouteLine,
    createNetworkLayers,
    routeStops,
    routeTerminals,
    userLocationPulse,
    userLocationPoint,
    getVehicleColorExpression,
    MAP_SOURCES,
    STATION_CLUSTER_MAX_ZOOM,
} from '@/config/mapLayers';
import { STATION_CLUSTER_PROPERTIES, stopGlowColor, platformSortKey, stopBadgeImage } from '@/lib/map/stopExpressions';
import { modeColorsOf } from '@/lib/map/stopBadges';
import { EMPTY_FEATURE_COLLECTION } from '@/lib/geojson';
import { safeHexColor } from '@/lib/color';
import { AlertsLayer } from './AlertsLayer';

interface MapLayersProps {
    /** Whether the map instance has finished loading its style and assets */
    mapLoaded: boolean;
}

const shownStops = memoizeLast(mapStopsWithOverlay);
const stationFeatures = memoizeLast((stations: readonly Station[], hidden: HiddenNightLinesOf) => toMapStops(stations, hidden));
const platformFeatures = memoizeLast((platforms: readonly (Platform | Entrance)[], hidden: HiddenNightLinesOf) => toMapStops(platforms, hidden));
const networkPins = memoizeLast(pinsByNetwork);
const starredStops = memoizeLast(favoriteMarks);

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

    const { tripId, vehicleId } = useRouteParams();
    const { vehicles: ownVehicles } = useVehicles();
    const { model } = useStops();
    const hiddenNightLines = useHiddenNightLines();
    const networksInView = useNetworksInView();
    const overlay = useOverlayNetworks(networksInView);
    const displayVehicles = useMemo(() => withOverlay(ownVehicles, overlay.vehicles), [ownVehicles, overlay.vehicles]);
    const shown = shownStops(model, overlay.networks, stopTypeFilter);
    const stationsData = stationFeatures(shown.stations, hiddenNightLines);
    const stopsData = platformFeatures(shown.platforms, hiddenNightLines);
    const starred = starredStops(networkPins(favoriteStops, selectedCity, model, overlay.networks));
    const stationBadgeImage = useMemo(() => stopBadgeImage(selectedCity, starred.stationIds), [selectedCity, starred.stationIds]);
    const platformBadgeImage = useMemo(() => stopBadgeImage(selectedCity, starred.platformIds), [selectedCity, starred.platformIds]);
    const platformOrder = useMemo(() => platformSortKey(starred.platformIds), [starred.platformIds]);
    const routeShapeData = useRouteShape();
    const network = useNetworkLayer();
    const networkColors = network?.colors;
    const selectedVehicle = useSelectedVehicle();
    const { selectedVehicleFeature, vehiclesFilter } = useMapFilters(selectedVehicle, tripId || vehicleId, delayFilter);

    const stationText = showStopLabels ? stationBadges.layout?.['text-field'] : '';

    const { resolvedTheme } = useTheme();
    const haloColor = resolvedTheme === 'dark' ? '#111111' : '#ffffff';
    const textColor = resolvedTheme === 'dark' ? '#bdbdbd' : '#111111';
    const glowColor = useMemo(() => stopGlowColor(modeColorsOf(selectedCity), resolvedTheme === 'light' ? 'light' : 'dark'), [selectedCity, resolvedTheme]);

    const routeColor = safeHexColor(routeShapeData?.features[0]?.properties?.route_color as string | undefined);
    const routeLine = useMemo(() => createRouteLine(routeColor, resolvedTheme === 'light' ? 'light' : 'dark'), [routeColor, resolvedTheme]);
    const hasRoute = Boolean(routeShapeData?.features.length);
    // The selected line leaves the network only once the trip draws its own, so it never blinks out while the shape loads.
    const routeLineName = hasDrawnLine(routeShapeData) ? selectedVehicle?.route_short_name ?? null : null;
    const [networkCasing, networkLine] = useMemo(
        () => createNetworkLayers(resolvedTheme === 'light' ? 'light' : 'dark', hasRoute, routeLineName, networkColors ?? []),
        [resolvedTheme, hasRoute, routeLineName, networkColors]);

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

    const filteredStationsData = showStops ? stationsData : EMPTY_FEATURE_COLLECTION;
    const filteredStopsData = showStops ? stopsData : EMPTY_FEATURE_COLLECTION;

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
            <Source id={MAP_SOURCES.NETWORK_LINES} type="geojson" data={network?.lines ?? EMPTY_FEATURE_COLLECTION}>
                <Layer {...networkCasing} />
                <Layer {...networkLine} />
            </Source>

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

            {/* Vehicles under the stations: a vehicle at a stop never covers its badge, and the name's halo keeps it readable over it. */}
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

            {/* Over the vehicles, under the stops: the stop at an alert's point stays readable over the sign's leg. */}
            <AlertsLayer mapLoaded={mapLoaded} />

            <Source
                id={MAP_SOURCES.STATIONS}
                type="geojson"
                data={filteredStationsData}
                cluster={true}
                clusterMaxZoom={STATION_CLUSTER_MAX_ZOOM}
                clusterRadius={STOP_GLOW.clusterRadius}
                clusterProperties={STATION_CLUSTER_PROPERTIES}
            >
                <Layer {...stopGlows} paint={{ ...stopGlows.paint, 'circle-color': glowColor }} />
                <Layer {...stopGlowCores} paint={{ ...stopGlowCores.paint, 'circle-color': glowColor }} />
                <Layer
                    {...stationBadges}
                    layout={{ ...stationBadges.layout, 'icon-image': stationBadgeImage, 'text-field': stationText }}
                    paint={{ ...stationBadges.paint, 'text-color': textColor, 'text-halo-color': haloColor }}
                />
                {showStopLabels && <Layer {...stationNames} paint={{ ...stationNames.paint, 'text-color': textColor, 'text-halo-color': haloColor }} />}
            </Source>

            <Source id={MAP_SOURCES.STOPS} type="geojson" data={filteredStopsData}>
                {/* Entrances under the vehicles and stations, so a station's name is placed before them. */}
                <Layer
                    {...stopEntrances}
                    beforeId={vehicleSelectedPulse.id}
                    paint={{ ...(stopEntrances.paint as SymbolLayerSpecification['paint']), 'text-halo-color': haloColor }}
                />
                {/* Platforms on top: small and tapped, they must not hide under a vehicle; placed first, so names move off them. */}
                <Layer {...platformBadges} layout={{ ...platformBadges.layout, 'icon-image': platformBadgeImage, 'symbol-sort-key': platformOrder }} />
            </Source>
        </>
    );
});

MapLayers.displayName = 'MapLayers';
