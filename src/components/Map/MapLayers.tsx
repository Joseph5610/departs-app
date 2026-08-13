
import React from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import type { FilterSpecification, SymbolLayerSpecification } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { useTheme } from 'next-themes';
import type { VehicleCollection, StopCollection, StopProperties } from '../../types/transit';
import { useMapMetadataStore } from '../../state/mapMetadataStore';
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
    getVehicleColorExpression
} from '../../config/mapLayers';

interface MapLayersProps {
    /** Whether the map instance has finished loading its style and assets */
    mapLoaded: boolean;
    /** Global visibility toggle for vehicles */
    showVehicles: boolean;
    /** Global visibility toggle for stops */
    showStops: boolean;
    /** Whether to show stop name labels */
    showStopLabels: boolean;
    /** Stop type filter: empty = show all, ['metro'] = metro only, ['train'] = trains only */
    stopTypeFilter: string[];
    /** Collection of all vehicles to be displayed */
    displayVehicles: VehicleCollection | null;
    /** Collection of physical stop locations (points) */
    stopsData: StopCollection | null;
    /** Collection of stop label centroids (text) */
    labelData: StopCollection | null;
    /** GeoJSON LineString for the currently selected route */
    routeShapeData: FeatureCollection | null;
    /** User's current [lng, lat] coordinates */
    userLocation: [number, number] | null;
    /** GeoJSON FeatureCollection containing only the currently selected vehicle */
    selectedVehicleFeature: VehicleCollection;
    /** List of favorite stop IDs */
    favoriteStops: string[];
    /** Filter expression to exclude selected vehicle from the main vehicle layer */
    vehiclesFilter: FilterSpecification;
    /** Whether to color vehicles by delay */
    colorVehiclesByDelay?: boolean;
    /** ID of the first label layer in the style, used for correct layering (Z-index) */
    labelLayerId?: string;
}

const EMPTY_GEOJSON: FeatureCollection = {
    type: 'FeatureCollection',
    features: []
};

/**
 * MapLayers Component
 *
 * This component is responsible for rendering all MapLibre sources and layers.
 * It is isolated from the main Map UI to ensure that map style updates are decoupled
 * from UI state changes (like opening sidebars or settings).
 *
 * PERFORMANCE: This component is wrapped in React.memo to prevent expensive re-renders
 * unless the underlying GeoJSON data or styling properties actually change.
 */
export const MapLayers: React.FC<MapLayersProps> = React.memo(({
    mapLoaded,
    showVehicles,
    showStops,
    showStopLabels,
    stopTypeFilter,
    displayVehicles,
    stopsData,
    labelData,
    routeShapeData,
    userLocation,
    selectedVehicleFeature,
    favoriteStops,
    vehiclesFilter,
    colorVehiclesByDelay = false
}) => {
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
        displayVehicles,
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
        if (!isEnabled || !data) return EMPTY_GEOJSON;
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
            <Source id="route-shape" type="geojson" data={routeShapeData || EMPTY_GEOJSON}>
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

            <Source id="user-location" type="geojson" data={userLocation ? {
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: userLocation },
                    properties: {}
                }]
            } : EMPTY_GEOJSON}>
                <Layer {...userLocationPulse} />
                <Layer {...userLocationPoint} />
            </Source>

            <Source id="selected-vehicle" type="geojson" data={selectedGeoJSON}>
                <Layer {...vehicleSelectedPulse} paint={{ ...vehicleSelectedPulse.paint, 'circle-color': vehicleColorExpr }} />
                <Layer {...vehicleSelectedPoint} paint={{ ...vehicleSelectedPoint.paint, 'circle-color': vehicleColorExpr }} />
                <Layer {...vehicleSelectedDirection} paint={{ ...vehicleSelectedDirection.paint, 'icon-color': vehicleColorExpr }} />
                <Layer {...vehicleSelectedLabel} paint={{ ...vehicleSelectedLabel.paint, 'text-color': textColor, 'text-halo-color': haloColor }} />
            </Source>

            <Source id="city-vehicles" type="geojson" data={showVehicles ? displayGeoJSON : EMPTY_GEOJSON}>
                <Layer {...vehiclePoints} filter={vehiclesFilter} paint={{ ...vehiclePoints.paint, 'circle-color': vehicleColorExpr }} />
                <Layer {...vehicleDirections} filter={vehiclesFilter} paint={{ ...vehicleDirections.paint, 'icon-color': vehicleColorExpr }} />
                <Layer {...vehicleLabels} filter={vehiclesFilter} paint={{ ...(vehicleLabels.paint as SymbolLayerSpecification['paint']), 'text-color': textColor, 'text-halo-color': haloColor }} />
            </Source>

            <Source id="stop-labels-centroids" type="geojson" data={filteredLabelData}>
                <Layer {...stopLabels} paint={{ ...(stopLabels.paint as SymbolLayerSpecification['paint']), 'text-color': textColor, 'text-halo-color': haloColor }} />
            </Source>

            <Source
                id="city-stops"
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
                        filter={['any', ...favoriteStops.map(id => ['==', ['get', 'stop_id'], id])] as FilterSpecification}
                    />
                )}
            </Source>
        </>
    );
});

MapLayers.displayName = 'MapLayers';
