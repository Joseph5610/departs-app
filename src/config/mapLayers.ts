import type {
    CircleLayerSpecification,
    SymbolLayerSpecification,
    LineLayerSpecification
} from 'maplibre-gl';

export const MAP_TOKENS = {
    zoom: {
        vehicles: { min: 10, max: 15 },
        stops: { min: 13, max: 17 },
        icons: 13.5, // Unified zoom level for all icons (bus, platform, train)
        labels: 14, // Unified zoom level for labels
    },
    colors: {
        glow: '#000000',
        stroke: '#000000',
        routeDefault: '#ffffff',
        blueCluster: '#1e3a8a',
        favorite: '#f59e0b',
        vehicleLabelText: '#f8fafc',
        stopIconHalo: '#000000',
        platformText: '#cbd5e1'
    }
};

// -----------------------------------------------------------------------------
// STOPS & STATIONS
// -----------------------------------------------------------------------------

export const stopClusters: CircleLayerSpecification = {
    id: 'clusters',
    type: 'circle',
    source: 'city-stops',
    filter: ['has', 'point_count'],
    paint: {
        'circle-color': MAP_TOKENS.colors.blueCluster,
        'circle-radius': [
            'interpolate', ['linear'], ['get', 'point_count'],
            1, 6,
            50, 15,
            100, 25
        ],
        'circle-opacity': [
            'interpolate', ['linear'], ['zoom'],
            8, 0.4,
            13, 0.7
        ],
        'circle-blur': 1.0 // Maximum blur for the "glow" effect
    }
};

export const stopPointsGlow: CircleLayerSpecification = {
    id: 'unclustered-point-glow',
    type: 'circle',
    source: 'city-stops',
    filter: ['all',
        ['!', ['has', 'point_count']],
        ['!=', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 2]
    ],
    paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'],
            MAP_TOKENS.zoom.stops.min, 9.5,
            MAP_TOKENS.zoom.stops.max, 28.5
        ],
        'circle-color': MAP_TOKENS.colors.glow, // Black glow for all ensures glass transparency works
        'circle-opacity': ['interpolate', ['linear'], ['zoom'],
            MAP_TOKENS.zoom.stops.min, 0.1,
            MAP_TOKENS.zoom.stops.max, 0.2
        ],
        'circle-blur': 1.0
    }
};

export const stopPoints: CircleLayerSpecification = {
    id: 'unclustered-point',
    type: 'circle',
    source: 'city-stops',
    filter: ['all',
        ['!', ['has', 'point_count']],
        ['!=', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 2],
        ['!', ['all',
            ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1],
            ['>=', ['length', ['coalesce', ['get', 'metro_lines'], ['literal', []]]], 2]
        ]]
    ],
    paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'],
            MAP_TOKENS.zoom.stops.min, 5.7,
            MAP_TOKENS.zoom.stops.max, 20.9
        ],
        'circle-color': [
            'coalesce',
            ['get', 'metro_color'],
            ['case', ['==', ['get', 'is_train'], 1], '#1c1745', MAP_TOKENS.colors.blueCluster]
        ],
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], MAP_TOKENS.zoom.stops.min, 1.0, MAP_TOKENS.zoom.stops.max, 2.0],
        'circle-stroke-color': MAP_TOKENS.colors.stroke,
        'circle-opacity': [
            'case',
            ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1],
            0.75, // More transparent for vibrant metro stations
            0.85  // Standard for others
        ],
        'circle-stroke-opacity': 0.8
    }
};

export const transferOuterPoints: CircleLayerSpecification = {
    id: 'transfer-outer',
    type: 'circle',
    source: 'city-stops',
    filter: ['all',
        ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1],
        ['>=', ['length', ['coalesce', ['get', 'metro_lines'], ['literal', []]]], 2]
    ],
    minzoom: 10,
    paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'],
            MAP_TOKENS.zoom.stops.min, 6.5,
            MAP_TOKENS.zoom.stops.max, 24
        ],
        'circle-color': ['coalesce', ['get', 'metro_color'], '#0f172a'],
        'circle-stroke-color': MAP_TOKENS.colors.stroke,
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], MAP_TOKENS.zoom.stops.min, 1, MAP_TOKENS.zoom.stops.max, 3],
        'circle-opacity': 0.85
    }
};

export const transferInnerPoints: CircleLayerSpecification = {
    id: 'transfer-inner',
    type: 'circle',
    source: 'city-stops',
    filter: ['all',
        ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1],
        ['>=', ['length', ['coalesce', ['get', 'metro_lines'], ['literal', []]]], 2]
    ],
    minzoom: 10,
    paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'],
            MAP_TOKENS.zoom.stops.min, 4.5,
            MAP_TOKENS.zoom.stops.max, 16
        ],
        'circle-color': ['coalesce', ['get', 'metro_color_2'], '#ffffff'],
        'circle-opacity': 0.85
    }
};

export const stopLabels: SymbolLayerSpecification = {
    id: 'stop-labels',
    type: 'symbol',
    source: 'stop-labels-centroids',
    filter: ['all',
        ['!=', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 2]
    ],
    minzoom: MAP_TOKENS.zoom.labels,
    layout: {
        'text-field': ['get', 'stop_name'],
        'text-font': ['Montserrat Medium', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'],
            10, ['match', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1, 10, 8],
            16, ['match', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1, 14, 11]
        ],
        'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
        'text-radial-offset': ['interpolate', ['linear'], ['zoom'], MAP_TOKENS.zoom.stops.min, 2.2, MAP_TOKENS.zoom.stops.max, 4.2],
        'text-justify': 'auto',
        'text-max-width': 7,
        'text-letter-spacing': 0.15,
        'text-padding': 30,
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'symbol-sort-key': ['case',
            ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1], 1,
            ['==', ['get', 'is_train'], 1], 2,
            3
        ]
    },
    paint: {
        'text-color': '#bdbdbd',
        'text-halo-color': '#111111',
        'text-halo-width': 1,
        'text-halo-blur': 0.5
    }
};

// Merged layer for platform codes, bus icons, and train/metro icons
export const stopIcons: SymbolLayerSpecification = {
    id: 'stop-icons',
    type: 'symbol',
    source: 'city-stops',
    filter: ['all',
        ['!', ['has', 'point_count']],
        ['!=', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 2]
    ],
    minzoom: MAP_TOKENS.zoom.icons,
    layout: {
        'text-field': ['case', 
            ['any', ['==', ['get', 'is_train'], 1], ['==', ['get', 'metro_a'], 1], ['==', ['get', 'metro_b'], 1], ['==', ['get', 'metro_c'], 1]], '',
            ['has', 'platform_code'], ['get', 'platform_code'], 
            ''
        ],
        'text-font': ['Montserrat Medium', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], MAP_TOKENS.zoom.stops.min, 9, 18, 17],
        'text-anchor': 'center',
        'text-padding': 0,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'icon-image': ['case',
            ['any', ['==', ['get', 'is_train'], 1], ['==', ['get', 'metro_a'], 1], ['==', ['get', 'metro_b'], 1], ['==', ['get', 'metro_c'], 1]], 'train-icon',
            ['>', ['length', ['to-string', ['coalesce', ['get', 'platform_code'], '']]], 0], '',
            'bus-icon'
        ],
        'icon-size': ['interpolate', ['linear'], ['zoom'], MAP_TOKENS.zoom.stops.min, 0.09, MAP_TOKENS.zoom.stops.max, 0.28],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'symbol-sort-key': 5
    },
    paint: {
        'text-color': MAP_TOKENS.colors.platformText,
        'text-halo-color': MAP_TOKENS.colors.stopIconHalo,
        'text-halo-width': 0.8,
        'text-halo-blur': 0.2,
        'icon-color': '#ffffff',
        'icon-opacity': ['interpolate', ['linear'], ['zoom'], MAP_TOKENS.zoom.icons, 0, MAP_TOKENS.zoom.icons + 0.5, 1]
    }
};

export const stopEntrances: SymbolLayerSpecification = {
    id: 'entrance-layer',
    type: 'symbol',
    source: 'city-stops',
    filter: ['all',
        ['!', ['has', 'point_count']],
        ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 2]
    ],
    minzoom: 15.5,
    layout: {
        'text-field': ['get', 'stop_name'],
        'text-font': ['Montserrat Medium', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 15.5, 8, 18, 10],
        'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
        'text-radial-offset': 1.2,
        'text-letter-spacing': 0.1,
        'text-transform': 'uppercase',
        'text-padding': 10,
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'symbol-sort-key': 10
    },
    paint: {
        'text-color': '#64748b',
        'text-halo-color': MAP_TOKENS.colors.stroke,
        'text-halo-width': 1,
        'text-halo-blur': 0.2,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 15.5, 0, 16, 1]
    }
};

export const stopFavorites: SymbolLayerSpecification = {
    id: 'favorite-star-layer',
    type: 'symbol',
    source: 'city-stops',
    layout: {
        'icon-image': 'favorite-star',
        'icon-size': ['interpolate', ['linear'], ['zoom'],
            MAP_TOKENS.zoom.stops.min, 0.18,
            MAP_TOKENS.zoom.stops.max, 0.36
        ],
        'icon-offset': ['case',
            ['>=', ['length', ['coalesce', ['get', 'metro_lines'], ['literal', []]]], 2], ['literal', [45, -55]],
            ['literal', [35, -35]]
        ],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true
    },
    paint: {
        'icon-color': MAP_TOKENS.colors.favorite,
        'icon-halo-color': MAP_TOKENS.colors.stroke,
        'icon-halo-width': 1,
        'icon-opacity': 1
    }
};

// -----------------------------------------------------------------------------
// VEHICLES (Factories)
// -----------------------------------------------------------------------------

const createVehicleLayers = (sourceId: string, idPrefix: string, minzoom?: number) => {
    const point: CircleLayerSpecification = {
        id: `${idPrefix}-point`,
        type: 'circle',
        source: sourceId,
        ...(minzoom !== undefined && { minzoom }),
        paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], MAP_TOKENS.zoom.vehicles.min, 8, MAP_TOKENS.zoom.vehicles.max, 14],
            'circle-color': ['get', 'route_color'],
            'circle-stroke-width': 1.5,
            'circle-stroke-color': MAP_TOKENS.colors.stroke,
            'circle-opacity': 1
        }
    };

    const direction: SymbolLayerSpecification = {
        id: `${idPrefix}-direction`,
        type: 'symbol',
        source: sourceId,
        ...(minzoom !== undefined && { minzoom }),
        layout: {
            'icon-image': 'v-arrow-centered',
            'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.2, 16, 0.4],
            'icon-rotate': ['to-number', ['coalesce', ['get', 'bearing'], 0]],
            'icon-rotation-alignment': 'map',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-offset': [0, -48],
            'icon-anchor': 'center'
        },
        paint: {
            'icon-color': ['get', 'route_color'],
            'icon-opacity': [
                'case',
                ['any',
                    ['!', ['has', 'bearing']],
                    ['==', ['get', 'bearing'], null],
                    ['==', ['to-string', ['get', 'bearing']], ''],
                    ['==', ['to-number', ['coalesce', ['get', 'bearing'], 0]], 0]
                ],
                0,
                1
            ]
        }
    };

    const label: SymbolLayerSpecification = {
        id: `${idPrefix}-label`,
        type: 'symbol',
        source: sourceId,
        ...(minzoom !== undefined && { minzoom }),
        layout: {
            'text-field': ['to-string', ['coalesce', ['get', 'route_short_name'], '']],
            'text-font': ['Montserrat Medium', 'Arial Unicode MS Regular'],
            'text-size': ['interpolate', ['linear'], ['zoom'], MAP_TOKENS.zoom.vehicles.min, 9, 16, 13],
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'text-anchor': 'center'
        },
        paint: {
            'text-color': MAP_TOKENS.colors.vehicleLabelText,
            'text-halo-color': MAP_TOKENS.colors.stroke,
            'text-halo-width': 1.2,
            'text-halo-blur': 0.4,
            'text-opacity': 1
        }
    };

    return { point, direction, label };
};

export const { point: vehicleSelectedPoint, direction: vehicleSelectedDirection, label: vehicleSelectedLabel } = createVehicleLayers('selected-vehicle', 'vehicle-selected');
export const { point: vehiclePoints, direction: vehicleDirections, label: vehicleLabels } = createVehicleLayers('city-vehicles', 'vehicles', 10);

// Specific to selected vehicle
export const vehicleSelectedPulse: CircleLayerSpecification = {
    id: 'vehicle-selected-pulse',
    type: 'circle',
    source: 'selected-vehicle',
    paint: {
        'circle-radius': 0,
        'circle-opacity': 0,
        'circle-color': ['get', 'route_color']
    }
};

// -----------------------------------------------------------------------------
// ROUTES
// -----------------------------------------------------------------------------

export const routeLine: LineLayerSpecification = {
    id: 'route-line',
    type: 'line',
    source: 'route-shape',
    filter: ['==', ['geometry-type'], 'LineString'],
    layout: {
        'line-join': 'round',
        'line-cap': 'round'
    },
    paint: {
        'line-color': ['get', 'route_color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], MAP_TOKENS.zoom.vehicles.min, 3, MAP_TOKENS.zoom.vehicles.max, 8],
        'line-opacity': 0.8,
        'line-blur': 0.5
    }
};

const createRouteNodeLayer = (id: string, isTerminal: boolean): CircleLayerSpecification => {
    return {
        id,
        type: 'circle',
        source: 'route-shape',
        filter: ['all', 
            ['==', ['geometry-type'], 'Point'],
            isTerminal 
                ? ['any', ['==', ['get', 'is_start'], true], ['==', ['get', 'is_end'], true]] 
                : ['==', ['get', 'is_regular'], true]
        ],
        paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 
                MAP_TOKENS.zoom.vehicles.min, isTerminal ? 5 : 2.5, 
                MAP_TOKENS.zoom.vehicles.max, isTerminal ? 7 : 4.5
            ],
            'circle-color': MAP_TOKENS.colors.routeDefault,
            'circle-stroke-width': isTerminal ? 2.5 : 1.5,
            'circle-stroke-color': ['get', 'route_color'],
            'circle-opacity': 1
        }
    };
};

export const routeStops = createRouteNodeLayer('route-stops', false);
export const routeTerminals = createRouteNodeLayer('route-terminals', true);

// -----------------------------------------------------------------------------
// USER LOCATION
// -----------------------------------------------------------------------------

export const userLocationPulse: CircleLayerSpecification = {
    id: 'user-location-pulse',
    type: 'circle',
    source: 'user-location',
    paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 15, 15, 30],
        'circle-color': '#3b82f6',
        'circle-opacity': 0.15,
    }
};

export const userLocationPoint: CircleLayerSpecification = {
    id: 'user-location-point',
    type: 'circle',
    source: 'user-location',
    paint: {
        'circle-radius': 7,
        'circle-color': '#3b82f6',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#FFFFFF'
    }
};
