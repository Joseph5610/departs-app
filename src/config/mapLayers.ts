import type {
    CircleLayerSpecification,
    SymbolLayerSpecification,
    LineLayerSpecification,
    ExpressionSpecification
} from 'maplibre-gl';
import { DELAY_TIERS } from './transit';

/** GeoJSON source IDs, shared by the layers below, the <Source> elements and direct map updates. */
export const MAP_SOURCES = {
    STOPS: 'city-stops',
    STOP_LABELS: 'stop-labels-centroids',
    VEHICLES: 'city-vehicles',
    SELECTED_VEHICLE: 'selected-vehicle',
    ROUTE_SHAPE: 'route-shape',
    USER_LOCATION: 'user-location',
    POINTS_OF_SALE: 'points-of-sale-source',
} as const;

/** Canvas-drawn images registered by utils/mapIcons.ts. */
export const MAP_ICONS = {
    VEHICLE_ARROW: 'v-arrow-centered',
    TRAIN_STATION: 'train-icon',
    BUS_STOP: 'bus-icon',
    FAVORITE_STAR: 'favorite-star',
    POS_MACHINE: 'pos-machine-icon',
    POS_INFO: 'pos-info-icon',
    POS_OFFICE: 'pos-office-icon',
} as const;

export const MAP_LAYERS = {
    STOP_CLUSTERS: 'clusters',
    STOP_POINTS_GLOW: 'unclustered-point-glow',
    STOP_POINTS: 'unclustered-point',
    TRANSFER_OUTER: 'transfer-outer',
    TRANSFER_INNER: 'transfer-inner',
    STOP_LABELS: 'stop-labels',
    STOP_ICONS: 'stop-icons',
    STOP_ENTRANCES: 'entrance-layer',
    STOP_FAVORITES: 'favorite-star-layer',
    VEHICLE_POINTS: 'vehicles-point',
    VEHICLE_DIRECTIONS: 'vehicles-direction',
    VEHICLE_LABELS: 'vehicles-label',
    SELECTED_VEHICLE_PULSE: 'vehicle-selected-pulse',
    SELECTED_VEHICLE_POINT: 'vehicle-selected-point',
    SELECTED_VEHICLE_DIRECTION: 'vehicle-selected-direction',
    SELECTED_VEHICLE_LABEL: 'vehicle-selected-label',
    ROUTE_LINE_CASING: 'route-line-casing',
    ROUTE_LINE: 'route-line',
    ROUTE_STOPS: 'route-stops',
    ROUTE_TERMINALS: 'route-terminals',
    USER_LOCATION_PULSE: 'user-location-pulse',
    USER_LOCATION_POINT: 'user-location-point',
    POINTS_OF_SALE: 'pos-point',
} as const;

/** Layers whose click opens a stop's departures. */
export const STOP_CLICK_LAYERS: string[] = [MAP_LAYERS.STOP_POINTS, MAP_LAYERS.STOP_ICONS, MAP_LAYERS.TRANSFER_OUTER, MAP_LAYERS.TRANSFER_INNER];
/** Layers whose click opens a vehicle's detail. */
export const VEHICLE_CLICK_LAYERS: string[] = [MAP_LAYERS.VEHICLE_POINTS, MAP_LAYERS.VEHICLE_DIRECTIONS, MAP_LAYERS.VEHICLE_LABELS];
export const INTERACTIVE_LAYER_IDS: string[] = [...STOP_CLICK_LAYERS, MAP_LAYERS.STOP_CLUSTERS, ...VEHICLE_CLICK_LAYERS, MAP_LAYERS.POINTS_OF_SALE];

const MAP_FONT_STACK = ['Montserrat Medium', 'Arial Unicode MS Regular'];
const LOCATION_TYPE: ExpressionSpecification = ['to-number', ['coalesce', ['get', 'location_type'], 0]];
const METRO_LINE_COUNT: ExpressionSpecification = ['length', ['coalesce', ['get', 'metro_lines'], ['literal', []]]];
const IS_RAIL_STATION: ExpressionSpecification = ['any', ['==', ['get', 'is_train'], 1], ['==', ['get', 'metro_a'], 1], ['==', ['get', 'metro_b'], 1], ['==', ['get', 'metro_c'], 1]];

const MAP_TOKENS = {
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
    id: MAP_LAYERS.STOP_CLUSTERS,
    type: 'circle',
    source: MAP_SOURCES.STOPS,
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
    id: MAP_LAYERS.STOP_POINTS_GLOW,
    type: 'circle',
    source: MAP_SOURCES.STOPS,
    filter: ['all',
        ['!', ['has', 'point_count']],
        ['!=', LOCATION_TYPE, 2]
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
    id: MAP_LAYERS.STOP_POINTS,
    type: 'circle',
    source: MAP_SOURCES.STOPS,
    filter: ['all',
        ['!', ['has', 'point_count']],
        ['!=', LOCATION_TYPE, 2],
        ['!', ['all',
            ['==', LOCATION_TYPE, 1],
            ['>=', METRO_LINE_COUNT, 2]
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
            ['==', LOCATION_TYPE, 1],
            0.75, // More transparent for vibrant metro stations
            0.85  // Standard for others
        ],
        'circle-stroke-opacity': 0.8
    }
};

export const transferOuterPoints: CircleLayerSpecification = {
    id: MAP_LAYERS.TRANSFER_OUTER,
    type: 'circle',
    source: MAP_SOURCES.STOPS,
    filter: ['all',
        ['==', LOCATION_TYPE, 1],
        ['>=', METRO_LINE_COUNT, 2]
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
    id: MAP_LAYERS.TRANSFER_INNER,
    type: 'circle',
    source: MAP_SOURCES.STOPS,
    filter: ['all',
        ['==', LOCATION_TYPE, 1],
        ['>=', METRO_LINE_COUNT, 2]
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
    id: MAP_LAYERS.STOP_LABELS,
    type: 'symbol',
    source: MAP_SOURCES.STOP_LABELS,
    filter: ['all',
        ['!=', LOCATION_TYPE, 2]
    ],
    minzoom: MAP_TOKENS.zoom.labels,
    layout: {
        'text-field': ['get', 'stop_name'],
        'text-font': MAP_FONT_STACK,
        'text-size': ['interpolate', ['linear'], ['zoom'],
            10, ['match', LOCATION_TYPE, 1, 10, 8],
            16, ['match', LOCATION_TYPE, 1, 14, 11]
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
            ['==', LOCATION_TYPE, 1], 1,
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
    id: MAP_LAYERS.STOP_ICONS,
    type: 'symbol',
    source: MAP_SOURCES.STOPS,
    filter: ['all',
        ['!', ['has', 'point_count']],
        ['!=', LOCATION_TYPE, 2]
    ],
    minzoom: MAP_TOKENS.zoom.icons,
    layout: {
        'text-field': ['case', 
            IS_RAIL_STATION, '',
            ['has', 'platform_code'], ['get', 'platform_code'], 
            ''
        ],
        'text-font': MAP_FONT_STACK,
        'text-size': ['interpolate', ['linear'], ['zoom'], MAP_TOKENS.zoom.stops.min, 9, 18, 17],
        'text-anchor': 'center',
        'text-padding': 0,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'icon-image': ['case',
            IS_RAIL_STATION, MAP_ICONS.TRAIN_STATION,
            ['>', ['length', ['to-string', ['coalesce', ['get', 'platform_code'], '']]], 0], '',
            MAP_ICONS.BUS_STOP
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
    id: MAP_LAYERS.STOP_ENTRANCES,
    type: 'symbol',
    source: MAP_SOURCES.STOPS,
    filter: ['all',
        ['!', ['has', 'point_count']],
        ['==', LOCATION_TYPE, 2]
    ],
    minzoom: 15.5,
    layout: {
        'text-field': ['get', 'stop_name'],
        'text-font': MAP_FONT_STACK,
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
    id: MAP_LAYERS.STOP_FAVORITES,
    type: 'symbol',
    source: MAP_SOURCES.STOPS,
    layout: {
        'icon-image': MAP_ICONS.FAVORITE_STAR,
        'icon-size': ['interpolate', ['linear'], ['zoom'],
            MAP_TOKENS.zoom.stops.min, 0.18,
            MAP_TOKENS.zoom.stops.max, 0.36
        ],
        'icon-offset': ['case',
            ['>=', METRO_LINE_COUNT, 2], ['literal', [45, -55]],
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

export const getVehicleColorExpression = (colorVehiclesByDelay: boolean): ExpressionSpecification => {
    if (!colorVehiclesByDelay) {
        return ['get', 'route_color'] as ExpressionSpecification;
    }
    const unknownColor = DELAY_TIERS.filter(tier => tier.includesUnknown)[0].color;
    const expression: unknown[] = ['case', ['any', ['!', ['has', 'delay']], ['==', ['get', 'delay'], null]], unknownColor];
    for (const tier of DELAY_TIERS.slice(0, -1)) {
        expression.push(['<=', ['to-number', ['get', 'delay']], tier.maxDelayS], tier.color);
    }
    expression.push(DELAY_TIERS[DELAY_TIERS.length - 1].color);
    return expression as ExpressionSpecification;
};

export const getDelayFilterExpression = (delayFilter: string[]) => {
    if (!delayFilter || delayFilter.length === 0) {
        return null;
    }
    const delay = ['to-number', ['get', 'delay']];
    const conditions = DELAY_TIERS.flatMap((tier, i) => {
        if (!delayFilter.includes(tier.key)) return [];
        const bounds: unknown[] = [];
        if (i > 0) bounds.push(['>', delay, DELAY_TIERS[i - 1].maxDelayS]);
        if (Number.isFinite(tier.maxDelayS)) bounds.push(['<=', delay, tier.maxDelayS]);
        const inBand = ['all', ['!=', ['get', 'delay'], null], ...bounds];
        return [tier.includesUnknown ? ['any', ['!', ['has', 'delay']], ['==', ['get', 'delay'], null], inBand] : inBand];
    });
    if (conditions.length === 0) {
        return null;
    }
    return ['any', ...conditions];
};

const createVehicleLayers = (sourceId: string, ids: { point: string; direction: string; label: string }, minzoom?: number) => {
    const point: CircleLayerSpecification = {
        id: ids.point,
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
        id: ids.direction,
        type: 'symbol',
        source: sourceId,
        ...(minzoom !== undefined && { minzoom }),
        layout: {
            'icon-image': MAP_ICONS.VEHICLE_ARROW,
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
        id: ids.label,
        type: 'symbol',
        source: sourceId,
        ...(minzoom !== undefined && { minzoom }),
        layout: {
            'text-field': ['to-string', ['coalesce', ['get', 'route_short_name'], '']],
            'text-font': MAP_FONT_STACK,
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

export const { point: vehicleSelectedPoint, direction: vehicleSelectedDirection, label: vehicleSelectedLabel } = createVehicleLayers(MAP_SOURCES.SELECTED_VEHICLE, { point: MAP_LAYERS.SELECTED_VEHICLE_POINT, direction: MAP_LAYERS.SELECTED_VEHICLE_DIRECTION, label: MAP_LAYERS.SELECTED_VEHICLE_LABEL });
export const { point: vehiclePoints, direction: vehicleDirections, label: vehicleLabels } = createVehicleLayers(MAP_SOURCES.VEHICLES, { point: MAP_LAYERS.VEHICLE_POINTS, direction: MAP_LAYERS.VEHICLE_DIRECTIONS, label: MAP_LAYERS.VEHICLE_LABELS }, 10);

// Specific to selected vehicle
export const vehicleSelectedPulse: CircleLayerSpecification = {
    id: MAP_LAYERS.SELECTED_VEHICLE_PULSE,
    type: 'circle',
    source: MAP_SOURCES.SELECTED_VEHICLE,
    paint: {
        'circle-radius': 0,
        'circle-opacity': 0,
        'circle-color': ['get', 'route_color']
    }
};

// -----------------------------------------------------------------------------
// ROUTES
// -----------------------------------------------------------------------------

export const routeLineCasing: LineLayerSpecification = {
    id: MAP_LAYERS.ROUTE_LINE_CASING,
    type: 'line',
    source: MAP_SOURCES.ROUTE_SHAPE,
    filter: ['==', ['geometry-type'], 'LineString'],
    layout: {
        'line-join': 'round',
        'line-cap': 'round'
    },
    paint: {
        'line-color': '#71717a',
        'line-width': ['interpolate', ['linear'], ['zoom'], MAP_TOKENS.zoom.vehicles.min, 4, MAP_TOKENS.zoom.vehicles.max, 8],
        'line-opacity': 0.8
    }
};

export const routeLine: LineLayerSpecification = {
    id: MAP_LAYERS.ROUTE_LINE,
    type: 'line',
    source: MAP_SOURCES.ROUTE_SHAPE,
    filter: ['==', ['geometry-type'], 'LineString'],
    layout: {
        'line-join': 'round',
        'line-cap': 'round'
    },
    paint: {
        'line-color': ['get', 'route_color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], MAP_TOKENS.zoom.vehicles.min, 2.5, MAP_TOKENS.zoom.vehicles.max, 6],
        'line-opacity': [
            'case',
            ['==', ['get', 'status'], 'traversed'], 0.4,
            1.0
        ]
    }
};

const createRouteNodeLayer = (id: string, isTerminal: boolean): CircleLayerSpecification => {
    return {
        id,
        type: 'circle',
        source: MAP_SOURCES.ROUTE_SHAPE,
        filter: ['all', 
            ['==', ['geometry-type'], 'Point'],
            ['==', ['get', 'is_terminal'], isTerminal]
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

export const routeStops = createRouteNodeLayer(MAP_LAYERS.ROUTE_STOPS, false);
export const routeTerminals = createRouteNodeLayer(MAP_LAYERS.ROUTE_TERMINALS, true);

// -----------------------------------------------------------------------------
// USER LOCATION
// -----------------------------------------------------------------------------

export const userLocationPulse: CircleLayerSpecification = {
    id: MAP_LAYERS.USER_LOCATION_PULSE,
    type: 'circle',
    source: MAP_SOURCES.USER_LOCATION,
    paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 15, 15, 30],
        'circle-color': '#3b82f6',
        'circle-opacity': 0.15,
    }
};

export const userLocationPoint: CircleLayerSpecification = {
    id: MAP_LAYERS.USER_LOCATION_POINT,
    type: 'circle',
    source: MAP_SOURCES.USER_LOCATION,
    paint: {
        'circle-radius': 7,
        'circle-color': '#3b82f6',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#FFFFFF'
    }
};

// -----------------------------------------------------------------------------
// POINTS OF SALE
// -----------------------------------------------------------------------------

export const pointsOfSaleIcons: SymbolLayerSpecification = {
    id: MAP_LAYERS.POINTS_OF_SALE,
    type: 'symbol',
    source: MAP_SOURCES.POINTS_OF_SALE,
    minzoom: 16,
    layout: {
        'icon-image': [
            'match',
            ['get', 'type'],
            'ticketMachine', MAP_ICONS.POS_MACHINE,
            'informationCenter', MAP_ICONS.POS_INFO,
            'ticketOfficeMetro', MAP_ICONS.POS_OFFICE,
            'trainStation', MAP_ICONS.POS_OFFICE,
            'carrierOffice', MAP_ICONS.POS_OFFICE,
            MAP_ICONS.POS_MACHINE
        ],
        'icon-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            16, 0.35,
            18, 0.52
        ],
        'icon-allow-overlap': false,
        'text-field': ['step', ['zoom'], '', 17.5, ['get', 'name']],
        'text-font': MAP_FONT_STACK,
        'text-size': ['interpolate', ['linear'], ['zoom'], 17.5, 9.5, 19, 11],
        'text-offset': [0, 2.2],
        'text-anchor': 'top',
        'text-max-width': 7,
        'text-letter-spacing': 0.1,
        'text-optional': true,
        'symbol-sort-key': 100
    },
    paint: {
        'icon-opacity': 0.9,
        'text-color': '#94a3b8',
        'text-halo-color': '#0f172a',
        'text-halo-width': 1.5
    }
};
