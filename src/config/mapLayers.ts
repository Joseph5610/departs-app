import type { CircleLayerSpecification, SymbolLayerSpecification, LineLayerSpecification } from 'maplibre-gl';
import { LINE_COLORS, getStationColorMatchPairs } from './stations';

// 1. The GLOW Layer (Background)
export const clusterLayer: CircleLayerSpecification = {
    id: 'clusters',
    type: 'circle',
    source: 'pid-stops',
    filter: ['has', 'point_count'],
    paint: {
        // Glowing Color - Smart Clustering (Metro/Bus)
        'circle-color': [
            'case',
            // Metro C (Red)
            ['==', ['get', 'has_metro_c'], 1],
            ['interpolate', ['linear'], ['get', 'point_count'],
                0, '#fca5a5', 100, '#dc2626'],

            // Metro B (Yellow)
            ['==', ['get', 'has_metro_b'], 1],
            ['interpolate', ['linear'], ['get', 'point_count'],
                0, '#fde047', 100, '#ca8a04'],

            // Metro A (Green)
            ['==', ['get', 'has_metro_a'], 1],
            ['interpolate', ['linear'], ['get', 'point_count'],
                0, '#86efac', 100, '#16a34a'],

            // Default Bus (Blue)
            ['interpolate', ['linear'], ['get', 'point_count'],
                0, 'rgba(59, 130, 246, 0.4)',   // Very soft blue for small clusters
                100, 'rgba(37, 99, 235, 0.9)'  // Stronger blue for large clusters
            ]
        ],

        // Radius scaling - tighter bubbles
        'circle-radius': [
            '+',
            ['interpolate', ['linear'], ['get', 'point_count'], 0, 12, 100, 30],
            ['*', ['get', 'cluster_seed'], 8] // Reduced wobble
        ],

        // Opacity - Subtle flicker
        'circle-opacity': [
            '+',
            0.4,
            ['*', ['get', 'cluster_seed'], 0.3] // 0.4 - 0.7 range
        ],
        'circle-blur': 0.5     // Back to a slightly softer blur for premium feel
    }
};

// 2. The CORE Layer (Foreground - Bright Center)
export const clusterCoreLayer: CircleLayerSpecification = {
    id: 'cluster-core',
    type: 'circle',
    source: 'pid-stops',
    filter: ['has', 'point_count'],
    paint: {
        'circle-color': '#ffffff',
        'circle-radius': 2.5, // Smaller (was 4)
        'circle-opacity': 0.8, // Less harsh (was 1.0)
        'circle-blur': 0.4     // Softened edges (was 0)
    }
};

export const clusterCountLayer: SymbolLayerSpecification = {
    id: 'cluster-count',
    type: 'symbol',
    source: 'pid-stops',
    filter: ['has', 'point_count'],
    layout: {
        'text-field': '', // Empty text - we just want the circle
        'text-size': 0
    },
    paint: {
        'text-color': 'transparent'
    }
};

export const stopPointLayer: CircleLayerSpecification = {
    id: 'unclustered-point',
    type: 'circle',
    source: 'pid-stops',
    filter: ['all',
        ['!', ['has', 'point_count']],
        ['!=', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 2],
        // Only exclude Stations (Type 1) with transfer names, keeping Stops (Type 0) visible
        ['!', ['all',
            ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1],
            ['match', ['get', 'stop_name'], ['Můstek', 'Muzeum', 'Florenc'], true, false]
        ]]
    ],
    paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'],
            13, ['match', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1, 14, 8],
            17, ['match', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1, 24, 18]
        ],
        'circle-color': ['case',
            // Only apply custom colors for Stations (Type 1)
            ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1],
            ['match', ['get', 'stop_name'],
                ...(getStationColorMatchPairs() as any),
                LINE_COLORS.Unknown // Default for unknown stations
            ],

            // Default for Stops (Type 0 or null)
            LINE_COLORS.Default
        ] as any,
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 13, 1.5, 17, 2.5],
        'circle-stroke-color': ['case',
            // 1. Transfer Stations (Type 1 + Special Name) -> BLACK stroke
            ['all',
                ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1],
                ['match', ['get', 'stop_name'], ['Můstek', 'Muzeum', 'Florenc'], true, false]
            ],
            '#000000',

            // 2. Other Stations (Type 1) -> WHITE stroke
            ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1],
            '#ffffff',

            // 3. Regular Stops (Type 0) -> BLUE stroke
            '#3b82f6'
        ],
        'circle-opacity': [
            'case',
            ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1],
            0.7, // Semi-transparent "glassy" look for stations
            0.9  // Solid for regular stops
        ],
        'circle-stroke-opacity': 1
    }
};

// 3a. ATMOSPHERIC GLOW for Stations
export const stopPointGlowLayer: CircleLayerSpecification = {
    id: 'unclustered-point-glow',
    type: 'circle',
    source: 'pid-stops',
    filter: ['all',
        ['!', ['has', 'point_count']],
        ['!=', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 2]
    ],
    paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'],
            13, ['match', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1, 20, 12],
            17, ['match', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1, 40, 24]
        ],
        'circle-color': [
            'case',
            ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1],
            ['match', ['get', 'stop_name'],
                ...(getStationColorMatchPairs() as any),
                LINE_COLORS.Unknown
            ],
            '#000000' // Shadow for regular stops
        ] as any,
        'circle-opacity': ['interpolate', ['linear'], ['zoom'],
            13, ['match', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1, 0.2, 0.1],
            17, ['match', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1, 0.35, 0.2]
        ],
        'circle-blur': ['match', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1, 0.8, 1]
    }
};


export const transferStationLayer: SymbolLayerSpecification = {
    id: 'transfer-stations',
    type: 'symbol',
    source: 'pid-stops',
    filter: ['all',
        ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1],
        ['match', ['get', 'stop_name'], ['Můstek', 'Muzeum', 'Florenc'], true, false]
    ],
    minzoom: 10,
    layout: {
        'icon-image': ['match', ['get', 'stop_name'],
            'Můstek', 'transfer-A-B',
            'Muzeum', 'transfer-A-C',
            'Florenc', 'transfer-B-C',
            ''
        ],
        'icon-size': ['interpolate', ['linear'], ['zoom'],
            13, 0.875,
            17, 1.5
        ],
        'icon-allow-overlap': true,
        'icon-offset': ['match', ['get', 'stop_name'],
            'Muzeum', ['literal', [0, -15]], // Shift Muzeum UP to avoid overlap
            ['literal', [0, 0]]
        ]
    },
    paint: {
        'icon-opacity': 0.7 // Unified semi-transparency
    }
};

export const stopLabelLayer: SymbolLayerSpecification = {
    id: 'stop-labels',
    type: 'symbol',
    source: 'stop-labels-centroids',
    minzoom: 14, // Only show when clustering is off
    layout: {
        'text-field': ['get', 'stop_name'],
        'text-font': ['Montserrat Medium', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'],
            10, ['match', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1, 10, 8],
            16, ['match', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1, 14, 11]
        ],
        'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
        'text-radial-offset': ['interpolate', ['linear'], ['zoom'], 13, 1.5, 17, 3],
        'text-justify': 'auto',
        'text-max-width': 7,
        'text-letter-spacing': 0.15, // Matched to map style
        'text-padding': 20, // Aggressive padding to avoid overlaps
        'text-allow-overlap': true,
        'text-ignore-placement': true
    },
    paint: {
        'text-color': ['match', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1, '#ffffff', '#bdbdbd'],
        'text-halo-color': '#111111',
        'text-halo-width': 1, // Sharper halo like map labels
        'text-halo-blur': 0.5
    }
};

export const platformLabelLayer: SymbolLayerSpecification = {
    id: 'platform-labels',
    type: 'symbol',
    source: 'pid-stops',
    filter: ['all',
        ['!', ['has', 'point_count']],
        ['!=', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 2],
        ['has', 'platform_code'],
        ['>', ['length', ['to-string', ['get', 'platform_code']]], 0]
    ],
    minzoom: 14,
    layout: {
        'text-field': ['get', 'platform_code'],
        'text-font': ['Montserrat Medium', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 14, 11, 18, 15],
        'text-anchor': 'center',
        'text-padding': 25, // Large invisible box to push stop names away
        'text-allow-overlap': true,
        'text-ignore-placement': false
    },
    paint: {
        'text-color': '#f8fafc',
        'text-halo-color': '#000000',
        'text-halo-width': 0.8,
        'text-halo-blur': 0.2
    }
};

export const entranceLayer: SymbolLayerSpecification = {
    id: 'entrance-layer',
    type: 'symbol',
    source: 'pid-stops',
    filter: ['all',
        ['!', ['has', 'point_count']],
        ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 2]
    ],
    minzoom: 17.5, // Only show when very zoomed in
    layout: {
        'text-field': ['get', 'stop_name'],
        'text-font': ['Montserrat Medium', 'Arial Unicode MS Regular'],
        'text-size': 10,
        'text-letter-spacing': 0.1,
        'text-transform': 'uppercase',
        'text-padding': 40, // Deduplicate via padding
        'text-allow-overlap': false,
        'text-ignore-placement': false
    },
    paint: {
        'text-color': '#94a3b8', // Slate-400 (Greyish)
        'text-halo-color': '#000000',
        'text-halo-width': 1,
        'text-halo-blur': 0.2
    }
};

// 4. Vehicle Layers
import { vehicleColorExpression, isNightRouteExpression } from '../utils/vehicleColors';

export const selectedVehiclePulseLayer: CircleLayerSpecification = {
    id: 'selected-vehicle-pulse',
    type: 'circle',
    source: 'selected-vehicle',
    paint: {
        'circle-radius': 0, // Animated in component
        'circle-opacity': 0, // Animated in component
        'circle-color': vehicleColorExpression as any
    }
};

export const selectedVehiclePointLayer: CircleLayerSpecification = {
    id: 'selected-vehicle-point',
    type: 'circle',
    source: 'selected-vehicle',
    paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 15, 14],
        'circle-color': vehicleColorExpression as any,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': ['case', isNightRouteExpression as any, '#ffffff', '#000000'],
        'circle-opacity': 1
    }
};

export const selectedVehicleDirectionLayer: SymbolLayerSpecification = {
    id: 'selected-vehicle-direction',
    type: 'symbol',
    source: 'selected-vehicle',
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
        'icon-color': vehicleColorExpression as any,
        'icon-opacity': 1
    }
};

export const selectedVehicleLabelLayer: SymbolLayerSpecification = {
    id: 'selected-vehicle-label',
    type: 'symbol',
    source: 'selected-vehicle',
    layout: {
        'text-field': ['to-string', ['coalesce', ['get', 'gtfs_route_short_name'], ['get', 'route_short_name'], '']],
        'text-font': ['Montserrat Medium', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 16, 13],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'text-anchor': 'center'
    },
    paint: {
        'text-color': '#f8fafc',
        'text-halo-color': '#000000',
        'text-halo-width': 1.2,
        'text-halo-blur': 0.4,
        'text-opacity': 1
    }
};

export const vehiclesPointLayer: CircleLayerSpecification = {
    id: 'vehicles-point',
    type: 'circle',
    source: 'pid-vehicles',
    minzoom: 12,
    // Filter handled dynamically in component to exclude selected
    paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 15, 14],
        'circle-color': vehicleColorExpression as any,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': ['case', isNightRouteExpression as any, '#ffffff', '#000000'],
        'circle-opacity': 1
    }
};

export const vehiclesDirectionLayer: SymbolLayerSpecification = {
    id: 'vehicles-direction-all',
    type: 'symbol',
    source: 'pid-vehicles',
    minzoom: 12,
    // Filter handled dynamically in component
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
        'icon-color': vehicleColorExpression as any,
        'icon-opacity': 1
    }
};

export const vehiclesLabelLayer: SymbolLayerSpecification = {
    id: 'vehicles-label-all',
    type: 'symbol',
    source: 'pid-vehicles',
    minzoom: 12,
    // Filter handled dynamically in component
    layout: {
        'text-field': ['to-string', ['coalesce', ['get', 'gtfs_route_short_name'], ['get', 'route_short_name'], '']],
        'text-font': ['Montserrat Medium', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 16, 13],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'text-anchor': 'center'
    },
    paint: {
        'text-color': '#f8fafc',
        'text-halo-color': '#000000',
        'text-halo-width': 1.2,
        'text-halo-blur': 0.4,
        'text-opacity': 1
    }
};

export const routeLineLayer: LineLayerSpecification = {
    id: 'route-line',
    type: 'line',
    source: 'route-shape',
    layout: {
        'line-join': 'round',
        'line-cap': 'round'
    },
    paint: {
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 15, 8],
        'line-opacity': 0.8,
        'line-blur': 0.5
    }
};
