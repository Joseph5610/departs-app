import { LINE_COLORS, getStationColorMatchPairs } from './stations';

export const clusterLayer: any = {
    id: 'clusters',
    type: 'circle',
    source: 'pid-stops',
    filter: ['has', 'point_count'],
    paint: {
        'circle-color': '#334155',
        'circle-radius': ['step', ['get', 'point_count'], 15, 10, 20, 30, 25],
        'circle-opacity': 0.8,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#475569'
    }
};

export const clusterCountLayer: any = {
    id: 'cluster-count',
    type: 'symbol',
    source: 'pid-stops',
    filter: ['has', 'point_count'],
    layout: {
        'text-field': '{point_count_abbreviated}',
        'text-size': 12
    },
    paint: {
        'text-color': '#f8fafc'
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
        'circle-radius': ['match', ['to-number', ['coalesce', ['get', 'location_type'], 0]],
            1, 10, // Station
            6     // Stop
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
        'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.4, 15, 0.6],
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
        'text-field': [
            'case',
            ['all',
                ['!=', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1],
                ['has', 'platform_code'],
                ['>', ['length', ['to-string', ['get', 'platform_code']]], 0]
            ],
            ['concat', ['get', 'stop_name'], ' (', ['get', 'platform_code'], ')'],
            ['get', 'stop_name']
        ],
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 10, 8, 16, 12],
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
        'text-max-width': 10,
        'text-allow-overlap': false,
        'text-ignore-placement': false
    },
    paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#000000',
        'text-halo-width': 1
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
