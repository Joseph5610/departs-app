import { LINE_COLORS, getStationColorMatchPairs } from './stations';

// 1. The GLOW Layer (Background)
export const clusterLayer: any = {
    id: 'clusters',
    type: 'circle',
    source: 'pid-stops',
    filter: ['has', 'point_count'],
    paint: {
        // Glowing Color - Smooth Gradient (City Lights)
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
                0, '#e0f2fe',    // < 10: White/Cyan
                20, '#38bdf8',   // 20: Sky Blue
                100, '#0284c7'   // 100+: Ocean Blue
            ]
        ],

        // Radius scaling - smoother growth + Organic random factor
        'circle-radius': [
            '+',
            ['interpolate', ['linear'], ['get', 'point_count'], 0, 20, 100, 50],
            ['*', ['get', 'cluster_seed'], 15] // Add 0-15px random "wobble"
        ],

        // Opacity - Random flicker effect
        'circle-opacity': [
            '+',
            0.5,
            ['*', ['get', 'cluster_seed'], 0.3] // 0.5 - 0.8 opacity range
        ],
        'circle-blur': 0.6     // Less blur for better definition (neon style)
    }
};

// 2. The CORE Layer (Foreground - Bright Center)
export const clusterCoreLayer: any = {
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

export const clusterCountLayer: any = {
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

export const stopPointLayer: any = {
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
            13, ['match', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1, 10, 6],
            17, ['match', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1, 15, 11]
        ],
        'circle-color': ['case',
            // Only apply custom colors for Stations (Type 1)
            ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1],
            ['match', ['get', 'stop_name'],
                ...getStationColorMatchPairs(),
                LINE_COLORS.Unknown // Default for unknown stations
            ],

            // Default for Stops (Type 0 or null)
            LINE_COLORS.Default
        ],
        'circle-stroke-width': 2,
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
            '#38bdf8'
        ]
    }
};

export const transferStationLayer: any = {
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
        'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 15, 0.9],
        'icon-allow-overlap': true,
        'icon-offset': ['match', ['get', 'stop_name'],
            'Muzeum', ['literal', [0, -15]], // Shift Muzeum UP to avoid overlap
            ['literal', [0, 0]]
        ]
    }
};

export const stopLabelLayer: any = {
    id: 'stop-labels',
    type: 'symbol',
    source: 'pid-stops',
    filter: ['all',
        ['!', ['has', 'point_count']],
        ['!=', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 2]
    ],
    minzoom: 10,
    layout: {
        'text-field': ['get', 'stop_name'],
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 10, 8, 16, 12],
        'text-offset': [0, 1.5],
        'text-anchor': 'top',
        'text-max-width': 10,
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-padding': 20
    },
    paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#000000',
        'text-halo-width': 1
    }
};

export const platformLabelLayer: any = {
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
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 14, 9, 18, 13],
        'text-anchor': 'center',
        'text-allow-overlap': true,
        'text-ignore-placement': true
    },
    paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#000000',
        'text-halo-width': 0.5
    }
};

export const entranceLayer: any = {
    id: 'entrance-layer',
    type: 'symbol',
    source: 'pid-stops',
    filter: ['all',
        ['!', ['has', 'point_count']],
        ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 2]
    ],
    minzoom: 16,
    layout: {
        'text-field': ['get', 'stop_name'],
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size': 11,
        'text-allow-overlap': true,
        'text-ignore-placement': true
    },
    paint: {
        'text-color': '#e2e8f0',
        'text-halo-color': '#0f172a',
        'text-halo-width': 1
    }
};
