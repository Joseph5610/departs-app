
import React from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import type { LineLayerSpecification, FilterSpecification } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import type { VehicleCollection, StopCollection } from '../types/transit';
import {
    clusterLayer,
    clusterCountLayer,
    stopPointLayer,
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
    vehiclesLabelLayer
} from '../config/mapLayers';

interface MapLayersProps {
    /** Whether the map instance has finished loading its style and assets */
    mapLoaded: boolean;
    /** Global visibility toggle for vehicles */
    showVehicles: boolean;
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
    /** MapLibre paint properties for the route line */
    routeLinePaint: NonNullable<LineLayerSpecification['paint']>;
    /** MapLibre layout properties for the route line */
    routeLineLayout: NonNullable<LineLayerSpecification['layout']>;
    /** Filter expression to exclude selected vehicle from the main vehicle layer */
    vehiclesFilter: FilterSpecification;
    /** Whether to show the delay heatmap and zones */
    showHeatmap: boolean;
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
    displayVehicles,
    stopsData,
    labelData,
    routeShapeData,
    userLocation,
    selectedVehicleFeature,
    favoriteStops,
    routeLinePaint,
    routeLineLayout,
    vehiclesFilter,
    showHeatmap,
    labelLayerId
}) => {
    if (!mapLoaded) return null;

    return (
        <>
            {/* Route Shape Layer - UNDER labels */}
            <Source id="route-shape" type="geojson" data={routeShapeData || EMPTY_GEOJSON}>
                <Layer
                    id="route-line"
                    type="line"
                    beforeId={labelLayerId}
                    layout={routeLineLayout}
                    paint={routeLinePaint}
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

            <Source id="selected-vehicle" type="geojson" data={selectedVehicleFeature}>
                <Layer {...selectedVehiclePulseLayer} />
                <Layer {...selectedVehiclePointLayer} />
                <Layer {...selectedVehicleDirectionLayer} />
                <Layer {...selectedVehicleLabelLayer} />
            </Source>

            {/* Separate Source for Unclustered Heatmap */}
            <Source
                id="pid-vehicles-heatmap"
                type="geojson"
                data={showVehicles && showHeatmap && displayVehicles ? displayVehicles : EMPTY_GEOJSON}
            >
                <Layer
                    id="vehicles-heatmap"
                    type="heatmap"
                    filter={vehiclesFilter}
                    paint={{
                        'heatmap-weight': [
                            'interpolate',
                            ['linear'],
                            ['to-number', ['coalesce', ['get', 'delay'], 0]],
                            0, 0,
                            420, 1, // 7 minutes threshold
                            1200, 3 // 20 minutes max weight
                        ],
                        'heatmap-intensity': [
                            'interpolate',
                            ['linear'],
                            ['zoom'],
                            10, 1,
                            20, 4
                        ],
                        'heatmap-color': [
                            'interpolate',
                            ['linear'],
                            ['heatmap-density'],
                            0, 'rgba(79, 70, 229, 0)',   // Indigo-600 transparent
                            0.2, 'rgba(79, 70, 229, 0.4)', // Indigo-600
                            0.4, 'rgba(147, 51, 234, 0.6)', // Purple-600
                            0.7, 'rgba(236, 72, 153, 0.8)', // Pink-500
                            1.0, 'rgba(255, 255, 255, 0.9)' // White/Hot
                        ],
                        'heatmap-radius': [
                            'interpolate',
                            ['linear'],
                            ['zoom'],
                            10, 15,
                            20, 60
                        ],
                        'heatmap-opacity': [
                            'interpolate',
                            ['linear'],
                            ['zoom'],
                            14, 0.6,
                            20, 0.3
                        ]
                    }}
                />
            </Source>

            <Source
                id="pid-vehicles"
                type="geojson"
                data={showVehicles && displayVehicles ? displayVehicles : EMPTY_GEOJSON}
                cluster={showHeatmap}
                clusterMaxZoom={14}
                clusterRadius={50}
                clusterProperties={{
                    sum_delay: ['+', ['to-number', ['coalesce', ['get', 'delay'], 0]]]
                }}
            >
                {/* Delay Labels Layer */}
                <Layer
                    id="vehicles-delay-label"
                    type="symbol"
                    layout={{
                        visibility: showHeatmap ? 'visible' : 'none',
                        'text-field': [
                            'case',
                            ['has', 'point_count'],
                            ['case',
                                ['>=', ['/', ['get', 'sum_delay'], ['get', 'point_count']], 60],
                                ['concat', '+', ['to-string', ['round', ['/', ['/', ['get', 'sum_delay'], ['get', 'point_count']], 60]]], 'm'],
                                ''
                            ],
                            ['all', ['>=', ['get', 'delay'], 60], ['!', ['has', 'point_count']]],
                            ['concat', '+', ['to-string', ['round', ['/', ['get', 'delay'], 60]]], 'm'],
                            ''
                        ],
                        'text-font': ['Montserrat Bold', 'Arial Unicode MS Regular'],
                        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 16, 14],
                        'text-offset': [0, 1.5],
                        'text-anchor': 'top',
                        'text-allow-overlap': false
                    }}
                    paint={{
                        'text-color': '#ffffff',
                        'text-halo-color': 'rgba(0,0,0,0.8)',
                        'text-halo-width': 1.5
                    }}
                />

                <Layer {...vehiclesPointLayer} filter={showHeatmap ? (['all', vehiclesFilter, ['!', ['has', 'point_count']]] as any) : vehiclesFilter} />
                <Layer {...vehiclesDirectionLayer} filter={showHeatmap ? (['all', vehiclesFilter, ['!', ['has', 'point_count']]] as any) : vehiclesFilter} />
                <Layer {...vehiclesLabelLayer} filter={showHeatmap ? (['all', vehiclesFilter, ['!', ['has', 'point_count']]] as any) : vehiclesFilter} />
            </Source>

            <Source id="stop-labels-centroids" type="geojson" data={labelData ? labelData : EMPTY_GEOJSON}>
                <Layer {...stopLabelLayer} />
            </Source>

            <Source
                id="pid-stops"
                type="geojson"
                data={stopsData ? stopsData : EMPTY_GEOJSON}
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
                <Layer {...transferStationLayer} />
                <Layer {...platformLabelLayer} />
                <Layer {...entranceLayer} />
            </Source>
        </>
    );
});

MapLayers.displayName = 'MapLayers';
