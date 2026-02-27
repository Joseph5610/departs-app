
import React, { useEffect, useCallback } from 'react';
import { useMap as useMapcn } from '@/components/ui/map';
import type { LineLayerSpecification, FilterSpecification } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import type { VehicleCollection, StopCollection } from '../types/transit';
import { addAllIcons } from '../utils/mapIcons';
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
    /** ID of the first label layer in the style, used for correct layering (Z-index) */
    labelLayerId?: string;
}

const EMPTY_GEOJSON: FeatureCollection = {
    type: 'FeatureCollection',
    features: []
};

/**
 * MapLayers Component refactored for mapcn.
 * It uses the map instance from mapcn's context to manage layers directly via MapLibre API.
 */
export const MapLayers: React.FC<MapLayersProps> = React.memo(({
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
    labelLayerId
}) => {
    const { map, isLoaded: mapcnLoaded } = useMapcn();

    // Utility to safely add or update a GeoJSON source
    const updateSource = useCallback((id: string, data: any, options: any = {}) => {
        if (!map) return;
        const source = map.getSource(id);
        if (source) {
            (source as any).setData(data);
        } else {
            map.addSource(id, {
                type: 'geojson',
                data,
                ...options
            });
        }
    }, [map]);

    // Utility to safely add or update a layer
    const updateLayer = useCallback((layerConfig: any, beforeId?: string, filter?: any) => {
        if (!map) return;
        if (map.getLayer(layerConfig.id)) {
            if (filter !== undefined) {
                map.setFilter(layerConfig.id, filter);
            }
            // Update paint and layout properties if needed
            Object.entries(layerConfig.paint || {}).forEach(([key, value]) => {
                map.setPaintProperty(layerConfig.id, key, value);
            });
            Object.entries(layerConfig.layout || {}).forEach(([key, value]) => {
                map.setLayoutProperty(layerConfig.id, key, value);
            });
        } else {
            map.addLayer({
                ...layerConfig,
                ...(filter !== undefined && { filter })
            }, beforeId);
        }
    }, [map]);

    useEffect(() => {
        if (!map || !mapcnLoaded) return;

        // Initialize Icons
        addAllIcons(map);

        // Sources
        updateSource('route-shape', routeShapeData || EMPTY_GEOJSON);
        updateSource('user-location', userLocation ? {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                geometry: { type: 'Point', coordinates: userLocation },
                properties: {}
            }]
        } : EMPTY_GEOJSON);
        updateSource('selected-vehicle', selectedVehicleFeature);
        updateSource('pid-vehicles', showVehicles && displayVehicles ? displayVehicles : EMPTY_GEOJSON);
        updateSource('stop-labels-centroids', labelData || EMPTY_GEOJSON);
        updateSource('pid-stops', stopsData || EMPTY_GEOJSON, {
            cluster: true,
            clusterMaxZoom: 13,
            clusterRadius: 25,
            clusterProperties: {
                has_metro_a: ['max', ['get', 'metro_a']],
                has_metro_b: ['max', ['get', 'metro_b']],
                has_metro_c: ['max', ['get', 'metro_c']],
                cluster_seed: ['max', ['get', 'variant_seed']]
            }
        });

        // Layers
        // Route Line
        updateLayer({
            id: 'route-line',
            type: 'line',
            source: 'route-shape',
            layout: routeLineLayout,
            paint: routeLinePaint
        }, labelLayerId);

        // User Location
        updateLayer({
            id: 'user-location-pulse',
            type: 'circle',
            source: 'user-location',
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 15, 15, 30],
                'circle-color': '#3b82f6',
                'circle-opacity': 0.15,
            }
        });
        updateLayer({
            id: 'user-location-point',
            type: 'circle',
            source: 'user-location',
            paint: {
                'circle-radius': 7,
                'circle-color': '#3b82f6',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#FFFFFF'
            }
        });

        // Selected Vehicle
        updateLayer(selectedVehiclePulseLayer);
        updateLayer(selectedVehiclePointLayer);
        updateLayer(selectedVehicleDirectionLayer);
        updateLayer(selectedVehicleLabelLayer);

        // All Vehicles
        updateLayer(vehiclesPointLayer, undefined, vehiclesFilter);
        updateLayer(vehiclesDirectionLayer, undefined, vehiclesFilter);
        updateLayer(vehiclesLabelLayer, undefined, vehiclesFilter);

        // Stop Labels
        updateLayer(stopLabelLayer);

        // Stops & Clusters
        updateLayer(clusterLayer);
        updateLayer(clusterCountLayer);

        // Favorite stops
        if (favoriteStops.length > 0) {
            updateLayer({
                id: 'favorite-stops-glow',
                type: 'circle',
                source: 'pid-stops',
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 20, 17, 40],
                    'circle-color': '#f59e0b',
                    'circle-opacity': 0.4,
                    'circle-blur': 0.8
                }
            }, undefined, ['all',
                ['!', ['has', 'point_count']],
                ['in', ['get', 'stop_id'], ['literal', favoriteStops]]
            ]);
        } else if (map.getLayer('favorite-stops-glow')) {
            map.removeLayer('favorite-stops-glow');
        }

        updateLayer(stopPointGlowLayer);
        updateLayer(stopPointLayer);
        updateLayer(transferStationLayer);
        updateLayer(platformLabelLayer);
        updateLayer(entranceLayer);

    }, [
        map, mapcnLoaded, showVehicles, displayVehicles, stopsData, labelData,
        routeShapeData, userLocation, selectedVehicleFeature, favoriteStops,
        routeLinePaint, routeLineLayout, vehiclesFilter, labelLayerId,
        updateSource, updateLayer
    ]);

    return null;
});

MapLayers.displayName = 'MapLayers';
