import type {
    CircleLayerSpecification,
    SymbolLayerSpecification,
    LineLayerSpecification
} from 'maplibre-gl';




// 1. The GLOW Layer (Background)
export const clusterLayer: CircleLayerSpecification = {
    id: 'clusters',
    type: 'circle',
    source: 'city-stops',
    filter: ['has', 'point_count'],
    paint: {
        'circle-color': '#1e3a8a',
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

export const stopPointLayer: CircleLayerSpecification = {
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
            13, 5.7,
            17, 20.9
        ],
        'circle-color': [
            'coalesce',
            ['get', 'metro_color'],
            ['case', ['==', ['get', 'is_train'], 1], '#1c1745', '#1e3a8a']
        ],

        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 13, 1.0, 17, 2.0],
        'circle-stroke-color': '#000000',
        'circle-opacity': [
            'case',
            ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1],
            0.75, // More transparent for vibrant metro stations
            0.85  // Standard for others
        ],
        'circle-stroke-opacity': 0.8
    }
};

export const stopPointGlowLayer: CircleLayerSpecification = {
    id: 'unclustered-point-glow',
    type: 'circle',
    source: 'city-stops',
    filter: ['all',
        ['!', ['has', 'point_count']],
        ['!=', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 2]
    ],
    paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'],
            13, 9.5,
            17, 28.5
        ],
        'circle-color': '#000000', // Black glow for all ensures glass transparency works
        'circle-opacity': ['interpolate', ['linear'], ['zoom'],
            13, 0.1,
            17, 0.2
        ],
        'circle-blur': 1.0
    }
};



export const transferOuterLayer: CircleLayerSpecification = {
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
            13, 6.5,
            17, 24
        ],
        'circle-color': ['coalesce', ['get', 'metro_color'], '#0f172a'],
        'circle-stroke-color': '#000000',
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 13, 1, 17, 3],
        'circle-opacity': 0.85
    }
};

export const transferInnerLayer: CircleLayerSpecification = {
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
            13, 4.5,
            17, 16
        ],
        'circle-color': ['coalesce', ['get', 'metro_color_2'], '#ffffff'],
        'circle-opacity': 0.85
    }
};


export const stopLabelLayer: SymbolLayerSpecification = {
    id: 'stop-labels',
    type: 'symbol',
    source: 'stop-labels-centroids',
    filter: ['all',
        ['!=', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 2]
    ],
    minzoom: 14,
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

export const platformLabelLayer: SymbolLayerSpecification = {
    id: 'platform-labels',
    type: 'symbol',
    source: 'city-stops',
    filter: ['all',
        ['!', ['has', 'point_count']],
        ['!=', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 2],
        ['!', ['any',
            ['==', ['get', 'is_train'], 1],
            ['==', ['get', 'metro_a'], 1],
            ['==', ['get', 'metro_b'], 1],
            ['==', ['get', 'metro_c'], 1]
        ]]
    ],
    minzoom: 14.5,
    layout: {
        'text-field': ['case', ['has', 'platform_code'], ['get', 'platform_code'], ''],
        'text-font': ['Montserrat Medium', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 13, 9, 18, 17],
        'text-anchor': 'center',
        'text-padding': 0,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'icon-image': ['case',
            ['>', ['length', ['to-string', ['coalesce', ['get', 'platform_code'], '']]], 0],
            '',
            'bus-icon'
        ],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.09, 17, 0.28],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'symbol-sort-key': 5
    },
    paint: {
        'text-color': '#cbd5e1',
        'text-halo-color': '#000000',
        'text-halo-width': 0.8,
        'text-halo-blur': 0.2,
        'icon-color': '#ffffff',
        'icon-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.5, 1]
    }
};

export const entranceLayer: SymbolLayerSpecification = {
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
        'text-halo-color': '#000000',
        'text-halo-width': 1,
        'text-halo-blur': 0.2,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 15.5, 0, 16, 1]
    }
};

export const selectedVehiclePulseLayer: CircleLayerSpecification = {
    id: 'selected-vehicle-pulse',
    type: 'circle',
    source: 'selected-vehicle',
    paint: {
        'circle-radius': 0,
        'circle-opacity': 0,
        'circle-color': ['get', 'route_color']
    }
};

export const selectedVehiclePointLayer: CircleLayerSpecification = {
    id: 'selected-vehicle-point',
    type: 'circle',
    source: 'selected-vehicle',
    paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 15, 14],
        'circle-color': ['get', 'route_color'],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#000000',
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
    source: 'city-vehicles',
    minzoom: 10,
    paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 15, 14],
        'circle-color': ['get', 'route_color'],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#000000',
        'circle-opacity': 1
    }
};

export const vehiclesDirectionLayer: SymbolLayerSpecification = {
    id: 'vehicles-direction-all',
    type: 'symbol',
    source: 'city-vehicles',
    minzoom: 10,
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

export const vehiclesLabelLayer: SymbolLayerSpecification = {
    id: 'vehicles-label-all',
    type: 'symbol',
    source: 'city-vehicles',
    minzoom: 10,
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
    filter: ['==', ['geometry-type'], 'LineString'],
    layout: {
        'line-join': 'round',
        'line-cap': 'round'
    },
    paint: {
        'line-color': ['get', 'route_color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 15, 8],
        'line-opacity': 0.8,
        'line-blur': 0.5
    }
};

export const userLocationPulseLayer: CircleLayerSpecification = {
    id: 'user-location-pulse',
    type: 'circle',
    source: 'user-location',
    paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 15, 15, 30],
        'circle-color': '#3b82f6',
        'circle-opacity': 0.15,
    }
};

export const userLocationPointLayer: CircleLayerSpecification = {
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
export const favoriteStarLayer: SymbolLayerSpecification = {
    id: 'favorite-star-layer',
    type: 'symbol',
    source: 'city-stops',
    layout: {
        'icon-image': 'favorite-star',
        'icon-size': ['interpolate', ['linear'], ['zoom'],
            13, 0.18,
            17, 0.36
        ],
        'icon-offset': ['case',
            ['>=', ['length', ['coalesce', ['get', 'metro_lines'], ['literal', []]]], 2], ['literal', [45, -55]],
            ['literal', [35, -35]]
        ],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true
    },
    paint: {
        'icon-color': '#f59e0b',
        'icon-halo-color': '#000000',
        'icon-halo-width': 1,
        'icon-opacity': 1
    }
};

export const stationIconLayer: SymbolLayerSpecification = {
    id: 'station-icons',
    type: 'symbol',
    source: 'city-stops',
    filter: ['all',
        ['!', ['has', 'point_count']],
        ['any',
            ['==', ['get', 'is_train'], 1],
            ['==', ['get', 'metro_a'], 1],
            ['==', ['get', 'metro_b'], 1],
            ['==', ['get', 'metro_c'], 1]
        ]
    ],
    minzoom: 12,
    layout: {
        'icon-image': 'train-icon',
        'icon-size': ['interpolate', ['linear'], ['zoom'],
            13, 0.09,
            17, 0.28
        ],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true
    },
    paint: {
        'icon-color': '#ffffff',
        'icon-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0, 13, 1]
    }
};

export const routeStopsLayer: CircleLayerSpecification = {
    id: 'route-stops',
    type: 'circle',
    source: 'route-shape',
    filter: ['all', 
        ['==', ['geometry-type'], 'Point'],
        ['==', ['get', 'is_regular'], true]
    ],
    paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2.5, 15, 4.5],
        'circle-color': '#ffffff',
        'circle-stroke-width': 1.5,
        'circle-stroke-color': ['get', 'route_color'],
        'circle-opacity': 1
    }
};

export const routeTerminalsLayer: CircleLayerSpecification = {
    id: 'route-terminals',
    type: 'circle',
    source: 'route-shape',
    filter: ['all',
        ['==', ['geometry-type'], 'Point'],
        ['any', ['==', ['get', 'is_start'], true], ['==', ['get', 'is_end'], true]]
    ],
    paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 15, 7],
        'circle-color': '#ffffff',
        'circle-stroke-width': 2.5,
        'circle-stroke-color': ['get', 'route_color'],
        'circle-opacity': 1
    }
};


