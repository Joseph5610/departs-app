
import React from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import type { FilterSpecification } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import type { VehicleCollection, StopCollection } from '../../types/transit';
import {
    clusterLayer,
    stopPointLayer,
    transferOuterLayer,
    transferInnerLayer,
    stopLabelLayer,
    platformLabelLayer,
    entranceLayer,
    stopPointGlowLayer,
    favoriteStarLayer,
    selectedVehiclePulseLayer,
    selectedVehiclePointLayer,
    selectedVehicleDirectionLayer,
    selectedVehicleLabelLayer,
    vehiclesPointLayer,
    vehiclesDirectionLayer,
    vehiclesLabelLayer,
    routeLineLayer,
    userLocationPulseLayer,
    userLocationPointLayer,
    stationIconLayer
} from '../../config/mapLayers';

interface MapLayersProps {
    /** Whether the map instance has finished loading its style and assets */
    mapLoaded: boolean;
    /** Global visibility toggle for vehicles */
    showVehicles: boolean;
    /** Global visibility toggle for stops */
    showStops: boolean;
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
    displayVehicles,
    stopsData,
    labelData,
    routeShapeData,
    userLocation,
    selectedVehicleFeature,
    favoriteStops,
    vehiclesFilter,
    labelLayerId
}) => {
    if (!mapLoaded) return null;

    return (
        <>
            {/* Route Shape Layer - UNDER labels */}
            <Source id="route-shape" type="geojson" data={routeShapeData || EMPTY_GEOJSON}>
                <Layer
                    {...routeLineLayer}
                    beforeId={labelLayerId}
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
                <Layer {...userLocationPulseLayer} />
                <Layer {...userLocationPointLayer} />
            </Source>

            <Source id="selected-vehicle" type="geojson" data={selectedVehicleFeature}>
                <Layer {...selectedVehiclePulseLayer} />
                <Layer {...selectedVehiclePointLayer} />
                <Layer {...selectedVehicleDirectionLayer} />
                <Layer {...selectedVehicleLabelLayer} />
            </Source>

            <Source id="pid-vehicles" type="geojson" data={(showVehicles && displayVehicles ? displayVehicles : EMPTY_GEOJSON)}>
                <Layer {...vehiclesPointLayer} filter={vehiclesFilter} />
                <Layer {...vehiclesDirectionLayer} filter={vehiclesFilter} />
                <Layer {...vehiclesLabelLayer} filter={vehiclesFilter} />
            </Source>

            <Source id="stop-labels-centroids" type="geojson" data={(showStops && labelData ? labelData : EMPTY_GEOJSON)}>
                <Layer {...stopLabelLayer} />
            </Source>

            <Source
                id="pid-stops"
                type="geojson"
                data={(showStops && stopsData ? stopsData : EMPTY_GEOJSON)}
                cluster={true}
                clusterMaxZoom={13}
                clusterRadius={25}
                clusterProperties={{
                    has_metro_a: ['max', ['coalesce', ['get', 'metro_a'], 0]],
                    has_metro_b: ['max', ['coalesce', ['get', 'metro_b'], 0]],
                    has_metro_c: ['max', ['coalesce', ['get', 'metro_c'], 0]],
                    cluster_seed: ['max', ['coalesce', ['get', 'variant_seed'], 0]]
                }}
            >
                <Layer {...clusterLayer} />
                <Layer {...stopPointGlowLayer} />
                <Layer {...stopPointLayer} />
                <Layer {...transferOuterLayer} />
                <Layer {...transferInnerLayer} />
                <Layer {...stationIconLayer} />
                <Layer {...platformLabelLayer} />
                {/* Favorite Star Badge - Drawn last to be on top of everything */}
                {favoriteStops.length > 0 && (
                    <Layer
                        {...favoriteStarLayer}
                        filter={['any', ...favoriteStops.map(id => ['==', ['get', 'stop_id'], id])] as FilterSpecification}
                    />
                )}
                <Layer {...entranceLayer} />
            </Source>
        </>
    );
});

MapLayers.displayName = 'MapLayers';
