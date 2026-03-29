import type {
    CircleLayerSpecification,
    SymbolLayerSpecification,
    LineLayerSpecification
} from 'maplibre-gl';

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

        // Radius scaling: tiny dots at low zoom, bubbles at high zoom
        'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            8, ['+', 3, ['*', ['get', 'cluster_seed'], 3]],
            13, ['+', 12, ['*', ['get', 'cluster_seed'], 8]]
        ],

        // Opacity - Subtle flicker
        'circle-opacity': [
            'interpolate', ['linear'], ['zoom'],
            8, 0.3,
            13, ['+', 0.4, ['*', ['get', 'cluster_seed'], 0.3]]
        ],
        'circle-blur': [
            'interpolate', ['linear'], ['zoom'],
            8, 0.8,  // Slightly less blur for better visibility without core
            13, 0.3  // Sharper dot at higher zoom
        ]
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
        // Only exclude Stations (Type 1) with transfer icons, keeping Stops (Type 0) visible
        ['!', ['all',
            ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1],
            ['!=', ['get', 'transfer_icon'], '']
        ]]
    ],
    paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'],
            13, ['match', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1, 9.5, 5.7],
            17, ['match', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1, 26.6, 20.9]
        ],
        'circle-color': ['get', 'stop_color'],
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 13, 1.5, 17, 2.5],
        'circle-stroke-color': ['case',
            // 1. Transfer Stations (Type 1 + Icon) -> BLACK stroke
            ['all',
                ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1],
                ['!=', ['get', 'transfer_icon'], '']
            ],
            '#000000',

            // 2. Other Stations (Type 1) or Trains -> WHITE stroke
            ['any',
                ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1],
                ['==', ['get', 'is_train'], 1]
            ],
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
            13, ['match', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1, 14.2, 9.5],
            17, ['match', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1, 43.7, 28.5]
        ],
        'circle-color': [
            'case',
            ['any',
                ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1],
                ['==', ['get', 'is_train'], 1]
            ],
            ['get', 'stop_color'],
            '#000000' // Shadow for regular stops
        ],
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
        ['!=', ['get', 'transfer_icon'], '']
    ],
    minzoom: 10,
    layout: {
        'icon-image': ['get', 'transfer_icon'],
        'icon-size': ['interpolate', ['linear'], ['zoom'],
            13, 0.875,
            17, 1.5
        ],
        'icon-allow-overlap': true,
        'icon-offset': ['case',
            ['==', ['get', 'transfer_icon'], 'transfer-A-C'], ['literal', [0, -15]], // Shift Muzeum UP to avoid overlap
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
        'text-radial-offset': ['interpolate', ['linear'], ['zoom'], 13, 2.2, 17, 4.2],
        'text-justify': 'auto',
        'text-max-width': 7,
        'text-letter-spacing': 0.15, // Matched to map style
        'text-padding': 5, // Balanced padding
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'symbol-sort-key': ['case',
            ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1], 1, // Metro stations first
            ['==', ['get', 'is_train'], 1], 2, // Train stations second
            3 // Others last
        ]
    },
    paint: {
        'text-color': '#bdbdbd',
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
    minzoom: 14.5,
    layout: {
        'text-field': ['get', 'platform_code'],
        'text-font': ['Montserrat Medium', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 14, 12, 18, 17],
        'text-anchor': 'center',
        'text-padding': 2,
        'text-allow-overlap': false,
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
    minzoom: 15.0, // Only show when very zoomed in
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

export const selectedVehiclePulseLayer: CircleLayerSpecification = {
    id: 'selected-vehicle-pulse',
    type: 'circle',
    source: 'selected-vehicle',
    paint: {
        'circle-radius': 0, // Animated in component
        'circle-opacity': 0, // Animated in component
        'circle-color': ['get', 'line_color']
    }
};

export const selectedVehiclePointLayer: CircleLayerSpecification = {
    id: 'selected-vehicle-point',
    type: 'circle',
    source: 'selected-vehicle',
    paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 15, 14],
        'circle-color': ['get', 'line_color'],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': ['case', ['to-boolean', ['get', 'is_night']], '#ffffff', '#000000'],
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
        'icon-color': ['get', 'line_color'],
        'icon-opacity': [
            'case',
            ['any',
                ['!', ['has', 'bearing']],
                ['==', ['get', 'bearing'], null],
                ['==', ['to-string', ['get', 'bearing']], '']
            ],
            0,
            1
        ] as any
    }
};

export const selectedVehicleLabelLayer: SymbolLayerSpecification = {
    id: 'selected-vehicle-label',
    type: 'symbol',
    source: 'selected-vehicle',
    layout: {
        'text-field': ['to-string', ['coalesce', ['get', 'route_short_name'], '']],
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
    minzoom: 10,
    // Filter handled dynamically in component to exclude selected
    paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 15, 14],
        'circle-color': ['get', 'line_color'],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': ['case', ['to-boolean', ['get', 'is_night']], '#ffffff', '#000000'],
        'circle-opacity': 1
    }
};

export const vehiclesDirectionLayer: SymbolLayerSpecification = {
    id: 'vehicles-direction-all',
    type: 'symbol',
    source: 'pid-vehicles',
    minzoom: 10,
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
        'icon-color': ['get', 'line_color'],
        'icon-opacity': [
            'case',
            ['any',
                ['!', ['has', 'bearing']],
                ['==', ['get', 'bearing'], null],
                ['==', ['to-string', ['get', 'bearing']], '']
            ],
            0,
            1
        ] as any
    }
};

export const vehiclesLabelLayer: SymbolLayerSpecification = {
    id: 'vehicles-label-all',
    type: 'symbol',
    source: 'pid-vehicles',
    minzoom: 10,
    // Filter handled dynamically in component
    layout: {
        'text-field': ['to-string', ['coalesce', ['get', 'route_short_name'], '']],
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
        'line-color': ['get', 'line_color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 15, 8],
        'line-opacity': 0.8,
        'line-blur': 0.5
    }
};
