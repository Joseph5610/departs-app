
import React from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import type { FilterSpecification } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import type { VehicleCollection, StopCollection } from '../types/transit';
import {
    clusterLayer,
    clusterCountLayer,
    stopPointLayer,
    trainStationGlowLayer,
    trainStationLayer,
    transferStationLayer,
    stopLabelLayer,
    platformLabelLayer,
    entranceLayer,
    stopPointGlowLayer,
    selectedVehiclePulseLayer,
    selectedVehiclePointLayer,
    selectedVehicleDirectionLayer,
    selectedVehicleLabelLayer,
    vehiclesPointLayer,
    vehiclesDirectionLayer,
    vehiclesLabelLayer,
    routeLineLayer,
    parkingLayer,
    parkingLabelLayer,
    sharedCarsLayer,
    sharedCarsLabelLayer,
    bicycleCountersLayer,
    airQualityLayer
} from '../config/mapLayers';

interface MapLayersProps {
    /** Whether the map instance has finished loading its style and assets */
    mapLoaded: boolean;
    /** Global visibility toggles */
    showVehicles: boolean;
    showStops: boolean;
    showParking: boolean;
    showSharedCars: boolean;
    showBicycleCounters: boolean;
    showAirQuality: boolean;
    /** Data collections */
    displayVehicles: VehicleCollection | null;
    parkingData: FeatureCollection | null;
    sharedCarsData: FeatureCollection | null;
    bicycleCountersData: FeatureCollection | null;
    airQualityData: FeatureCollection | null;
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
    showParking,
    showSharedCars,
    showBicycleCounters,
    showAirQuality,
    displayVehicles,
    parkingData,
    sharedCarsData,
    bicycleCountersData,
    airQualityData,
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
                <Layer
                    id="user-location-pulse"
                    type="circle"
                    paint={{
                        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 15, 15, 30],
                        'circle-color': '#3b82f6',
                        'circle-opacity': 0.15,
                    }}
                />
                <Layer
                    id="user-location-point"
                    type="circle"
                    paint={{
                        'circle-radius': 7,
                        'circle-color': '#3b82f6',
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#FFFFFF'
                    }}
                />
            </Source>

            <Source id="selected-vehicle" type="geojson" data={selectedVehicleFeature as any}>
                <Layer {...selectedVehiclePulseLayer} />
                <Layer {...selectedVehiclePointLayer} />
                <Layer {...selectedVehicleDirectionLayer} />
                <Layer {...selectedVehicleLabelLayer} />
            </Source>

            <Source id="pid-vehicles" type="geojson" data={(showVehicles && displayVehicles ? displayVehicles : EMPTY_GEOJSON) as any}>
                <Layer {...vehiclesPointLayer} filter={vehiclesFilter} />
                <Layer {...vehiclesDirectionLayer} filter={vehiclesFilter} />
                <Layer {...vehiclesLabelLayer} filter={vehiclesFilter} />
            </Source>

            <Source id="stop-labels-centroids" type="geojson" data={(showStops && labelData ? labelData : EMPTY_GEOJSON) as any}>
                <Layer {...stopLabelLayer} />
            </Source>

            <Source id="pid-parking" type="geojson" data={(showParking && parkingData ? parkingData : EMPTY_GEOJSON) as any}>
                <Layer {...parkingLayer} />
                <Layer {...parkingLabelLayer} />
            </Source>

            <Source id="pid-shared-cars" type="geojson" data={(showSharedCars && sharedCarsData ? sharedCarsData : EMPTY_GEOJSON) as any}>
                <Layer {...sharedCarsLayer} />
                <Layer {...sharedCarsLabelLayer} />
            </Source>

            <Source id="pid-bicycle-counters" type="geojson" data={(showBicycleCounters && bicycleCountersData ? bicycleCountersData : EMPTY_GEOJSON) as any}>
                <Layer {...bicycleCountersLayer} />
            </Source>

            <Source id="pid-air-quality" type="geojson" data={(showAirQuality && airQualityData ? airQualityData : EMPTY_GEOJSON) as any}>
                <Layer {...airQualityLayer} />
            </Source>

            <Source
                id="pid-stops"
                type="geojson"
                data={(showStops && stopsData ? stopsData : EMPTY_GEOJSON) as any}
                cluster={true}
                clusterMaxZoom={13}
                clusterRadius={25}
                clusterProperties={{
                    has_metro_a: ['max', ['get', 'metro_a']],
                    has_metro_b: ['max', ['get', 'metro_b']],
                    has_metro_c: ['max', ['get', 'metro_c']],
                    cluster_seed: ['max', ['get', 'variant_seed']]
                }}
            >
                <Layer {...clusterLayer} />
                <Layer {...clusterCountLayer} />
                {/* Favorite stop highlight */}
                {favoriteStops.length > 0 && (
                    <Layer
                        id="favorite-stops-glow"
                        type="circle"
                        filter={['all',
                            ['!', ['has', 'point_count']],
                            ['in', ['get', 'stop_id'], ['literal', favoriteStops]]
                        ]}
                        paint={{
                            'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 20, 17, 40],
                            'circle-color': '#f59e0b',
                            'circle-opacity': 0.4,
                            'circle-blur': 0.8
                        }}
                    />
                )}
                <Layer {...stopPointGlowLayer} />
                <Layer {...stopPointLayer} />
                <Layer {...trainStationGlowLayer} />
                <Layer {...trainStationLayer} />
                <Layer {...transferStationLayer} />
                <Layer {...platformLabelLayer} />
                <Layer {...entranceLayer} />
            </Source>
        </>
    );
});

MapLayers.displayName = 'MapLayers';
