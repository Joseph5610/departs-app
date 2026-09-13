
import React from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import type { FilterSpecification, SymbolLayerSpecification } from 'maplibre-gl';
import { useTheme } from 'next-themes';
import type { StopCollection, StopProperties } from '../../types/transit';
import { useMapMetadataStore } from '../../state/mapMetadataStore';
import { usePreferencesStore } from '../../state/preferencesStore';
import { useGeolocationStore } from '../../state/geolocationStore';
import { useRouteParams } from '../../hooks/useRouteParams';
import { useVehicles } from '../../hooks/data/useVehicles';
import { useStops } from '../../hooks/data/useStops';
import { useRouteShape } from '../../hooks/derived/useRouteShape';
import { useMapFilters } from '../../hooks/derived/useMapFilters';
import { useSelectedVehicle } from '../../hooks/derived/useSelectedVehicle';
import { useVehicleAnimation } from '../../hooks/features/useVehicleAnimation';
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
    routeLine,
    routeStops,
    routeTerminals,
    userLocationPulse,
    userLocationPoint,
    getVehicleColorExpression,
    MAP_SOURCES
} from '../../config/mapLayers';
import { EMPTY_FEATURE_COLLECTION } from '../../lib/geojson';

interface MapLayersProps {
    /** Whether the map instance has finished loading its style and assets */
    mapLoaded: boolean;
}

/**
 * MapLayers Component
 *
 * This component is responsible for rendering all MapLibre sources and layers.
 * It is isolated from the main Map UI to ensure that map style updates are decoupled
 * from UI state changes (like opening sidebars or settings).
 *
 * PERFORMANCE: It subscribes to the map data itself, so live data updates re-render only this subtree,
 * and React.memo keeps parent re-renders out.
 */
export const MapLayers: React.FC<MapLayersProps> = React.memo(({ mapLoaded }) => {
    const showVehicles = usePreferencesStore(s => s.showVehicles);
    const showStops = usePreferencesStore(s => s.showStops);
    const showStopLabels = usePreferencesStore(s => s.showStopLabels);
    const stopTypeFilter = usePreferencesStore(s => s.stopTypeFilter);
    const favoriteStops = usePreferencesStore(s => s.favoriteStops);
    const colorVehiclesByDelay = usePreferencesStore(s => s.colorVehiclesByDelay);
    const delayFilter = usePreferencesStore(s => s.delayFilter);
    const userLocation = useGeolocationStore(s => s.userLocation);

    const { tripId, vehicleId } = useRouteParams();
    const { vehicles: displayVehicles } = useVehicles();
    const { stops: stopsData, centroids: labelData } = useStops();
    const routeShapeData = useRouteShape();
    const selectedVehicle = useSelectedVehicle();
    const { selectedVehicleFeature, vehiclesFilter } = useMapFilters(selectedVehicle, tripId || vehicleId, delayFilter);

    // Helper: does this feature pass the stop type filter?
    // Empty filter = show all. Otherwise include only matching types.
    const passesStopFilter = React.useCallback((props: StopProperties | null) => {
        if (!props || stopTypeFilter.length === 0) return true;
        const hasMetro = (props.metro_lines?.length ?? 0) > 0;
        const hasTrain = props.is_train === 1;
        if (stopTypeFilter.includes('metro') && hasMetro) return true;
        if (stopTypeFilter.includes('train') && hasTrain) return true;
        // Stop doesn't match any active filter
        return false;
    }, [stopTypeFilter]);

    const { resolvedTheme } = useTheme();
    const haloColor = resolvedTheme === 'dark' ? '#111111' : '#ffffff';
    const textColor = resolvedTheme === 'dark' ? '#bdbdbd' : '#111111';

    const mapRef = useMapMetadataStore(s => s.mapRef);
    const { displayGeoJSON, selectedGeoJSON } = useVehicleAnimation(
        mapRef,
        mapLoaded,
        displayVehicles ?? null,
        selectedVehicleFeature,
        showVehicles
    );

    // Dynamic vehicle color expression based on user preferences
    const vehicleColorExpr = React.useMemo(
        () => getVehicleColorExpression(colorVehiclesByDelay),
        [colorVehiclesByDelay]
    );

    // Filter GeoJSON based on stop type filters
    const filterGeoJSON = React.useCallback((data: StopCollection | null, isEnabled: boolean) => {
        if (!isEnabled || !data) return EMPTY_FEATURE_COLLECTION;
        if (stopTypeFilter.length === 0) return data;
        return {
            ...data,
            features: data.features.filter(f => passesStopFilter(f.properties))
        };
    }, [stopTypeFilter, passesStopFilter]);

    const filteredLabelData = React.useMemo(() => 
        filterGeoJSON(labelData, showStops && showStopLabels), 
        [labelData, showStops, showStopLabels, filterGeoJSON]
    );

    const filteredStopsData = React.useMemo(() => 
        filterGeoJSON(stopsData, showStops), 
        [stopsData, showStops, filterGeoJSON]
    );

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

            <Source id={MAP_SOURCES.USER_LOCATION} type="geojson" data={userLocation ? {
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: userLocation },
                    properties: {}
                }]
            } : EMPTY_FEATURE_COLLECTION}>
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
                {/* Favorite Star Badge - Drawn last to be on top of everything */}
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
