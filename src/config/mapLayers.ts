import { LINE_COLORS, getStationColorMatchPairs } from './stations';
import type { LayerProps } from 'react-map-gl/maplibre';

/**
 * Cluster Layers - Visual grouping of stops at lower zoom levels
 */

// 1. The GLOW Layer (Background) - Represents the density and type of stops
export const clusterLayer: LayerProps = {
    id: 'clusters',
    type: 'circle',
    source: 'pid-stops',
    filter: ['has', 'point_count'],
    paint: {
        'circle-color': [
            'case',
            // Metro C (Red)
            ['==', ['get', 'has_metro_c'], 1],
            ['interpolate', ['linear'], ['get', 'point_count'], 0, '#fca5a5', 100, '#dc2626'],

            // Metro B (Yellow)
            ['==', ['get', 'has_metro_b'], 1],
            ['interpolate', ['linear'], ['get', 'point_count'], 0, '#fde047', 100, '#ca8a04'],

            // Metro A (Green)
            ['==', ['get', 'has_metro_a'], 1],
            ['interpolate', ['linear'], ['get', 'point_count'], 0, '#86efac', 100, '#16a34a'],

            // Default Bus/Tram (Blue-ish)
            ['interpolate', ['linear'], ['get', 'point_count'],
                0, 'rgba(59, 130, 246, 0.5)',
                100, 'rgba(37, 99, 235, 0.9)'
            ]
        ],
        'circle-radius': [
            '+',
            ['interpolate', ['linear'], ['get', 'point_count'], 0, 14, 100, 35],
            ['*', ['coalesce', ['get', 'cluster_seed'], 0.5], 10] // Wobble based on seed
        ],
        'circle-opacity': [
            '+',
            0.3,
            ['*', ['coalesce', ['get', 'cluster_seed'], 0.5], 0.3] // 0.3 - 0.6 range
        ],
        'circle-blur': 0.6
    }
};

// 2. The CORE Layer - A bright center for the cluster
export const clusterCoreLayer: LayerProps = {
    id: 'cluster-core',
    type: 'circle',
    source: 'pid-stops',
    filter: ['has', 'point_count'],
    paint: {
        'circle-color': '#ffffff',
        'circle-radius': 3,
        'circle-opacity': 0.7,
        'circle-blur': 0.2
    }
};

// 3. The COUNT Layer - Shows the number of items in the cluster
export const clusterCountLayer: LayerProps = {
    id: 'cluster-count',
    type: 'symbol',
    source: 'pid-stops',
    filter: ['has', 'point_count'],
    layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['Montserrat Medium', 'Arial Unicode MS Regular'],
        'text-size': 12,
        'text-allow-overlap': true,
        'text-ignore-placement': true
    },
    paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#000000',
        'text-halo-width': 1
    }
};

/**
 * Unclustered Stop Layers
 */

export const stopPointLayer: LayerProps = {
    id: 'unclustered-point',
    type: 'circle',
    source: 'pid-stops',
    filter: ['all',
        ['!', ['has', 'point_count']],
        ['!=', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 2], // Not an entrance
        // Exclude major transfer stations that have custom icons
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
        'circle-color': [
            'case',
            ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1],
            ['match', ['get', 'stop_name'],
                ...getStationColorMatchPairs(),
                LINE_COLORS.Unknown
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ] as any,
            '#ffffff' // Regular stops are white
        ],
        'circle-opacity': [
            'case',
            ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1],
            0.7, // Semi-transparent glassy look for stations
            0.9  // Solid for regular stops
        ],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#000000',
        'circle-stroke-opacity': 0.5
    }
};

export const stopPointGlowLayer: LayerProps = {
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
                ...getStationColorMatchPairs(),
                LINE_COLORS.Unknown
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ] as any,
            '#000000'
        ],
        'circle-opacity': ['interpolate', ['linear'], ['zoom'],
            13, ['match', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1, 0.2, 0.1],
            17, ['match', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1, 0.35, 0.2]
        ],
        'circle-blur': ['match', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1, 0.8, 1]
    }
};

export const transferStationLayer: LayerProps = {
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
            'Muzeum', ['literal', [0, -15]],
            ['literal', [0, 0]]
        ]
    },
    paint: {
        'icon-opacity': 0.7
    }
};

export const stopLabelLayer: LayerProps = {
    id: 'stop-labels',
    type: 'symbol',
    source: 'stop-labels-centroids',
    minzoom: 14,
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
        'text-letter-spacing': 0.15,
        'text-padding': 20,
        'text-allow-overlap': true,
        'text-ignore-placement': true
    },
    paint: {
        'text-color': ['match', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 1, '#ffffff', '#bdbdbd'],
        'text-halo-color': '#111111',
        'text-halo-width': 1,
        'text-halo-blur': 0.5
    }
};

export const platformLabelLayer: LayerProps = {
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
        'text-padding': 25,
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

export const entranceLayer: LayerProps = {
    id: 'entrance-layer',
    type: 'symbol',
    source: 'pid-stops',
    filter: ['all',
        ['!', ['has', 'point_count']],
        ['==', ['to-number', ['coalesce', ['get', 'location_type'], 0]], 2]
    ],
    minzoom: 17.5,
    layout: {
        'text-field': ['get', 'stop_name'],
        'text-font': ['Montserrat Medium', 'Arial Unicode MS Regular'],
        'text-size': 10,
        'text-letter-spacing': 0.1,
        'text-transform': 'uppercase',
        'text-padding': 40,
        'text-allow-overlap': false,
        'text-ignore-placement': false
    },
    paint: {
        'text-color': '#94a3b8',
        'text-halo-color': '#000000',
        'text-halo-width': 1,
        'text-halo-blur': 0.2
    }
};

/**
 * Vehicle Layers
 */
import { vehicleColorExpression, isNightRouteExpression } from '../utils/vehicleColors';

export const selectedVehiclePulseLayer: LayerProps = {
    id: 'selected-vehicle-pulse',
    type: 'circle',
    paint: {
        'circle-radius': 0,
        'circle-opacity': 0,
        'circle-color': vehicleColorExpression
    }
};

export const selectedVehiclePointLayer: LayerProps = {
    id: 'selected-vehicle-point',
    type: 'circle',
    paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 15, 14],
        'circle-color': vehicleColorExpression,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': ['case', isNightRouteExpression, '#ffffff', '#000000'],
        'circle-opacity': 1
    }
};

export const selectedVehicleDirectionLayer: LayerProps = {
    id: 'selected-vehicle-direction',
    type: 'symbol',
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
        'icon-color': vehicleColorExpression,
        'icon-opacity': 1
    }
};

export const selectedVehicleLabelLayer: LayerProps = {
    id: 'selected-vehicle-label',
    type: 'symbol',
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

export const vehiclesPointLayer: LayerProps = {
    id: 'vehicles-point',
    type: 'circle',
    minzoom: 12,
    paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 15, 14],
        'circle-color': vehicleColorExpression,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': ['case', isNightRouteExpression, '#ffffff', '#000000'],
        'circle-opacity': 1
    }
};

export const vehiclesDirectionLayer: LayerProps = {
    id: 'vehicles-direction-all',
    type: 'symbol',
    minzoom: 12,
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
        'icon-color': vehicleColorExpression,
        'icon-opacity': 1
    }
};

export const vehiclesLabelLayer: LayerProps = {
    id: 'vehicles-label-all',
    type: 'symbol',
    minzoom: 12,
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
