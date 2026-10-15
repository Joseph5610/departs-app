import type {
    CircleLayerSpecification,
    SymbolLayerSpecification,
    LineLayerSpecification,
    ExpressionSpecification
} from 'maplibre-gl';
import type { RouteType } from '@/types';
import { DELAY_TIERS, ROUTE_TYPE_ORDER } from './transit';
import { FALLBACK_ROUTE_COLOR } from './constants';
import { mixHex } from '@/lib/color';

/** A feature's line colour; a vehicle reaches the map uncoloured until its city's routes.json loads, or for a line it lacks. */
const ROUTE_COLOR: ExpressionSpecification = ['to-color', ['get', 'route_color'], FALLBACK_ROUTE_COLOR];

/** GeoJSON source IDs, shared by the layers below, the <Source> elements and direct map updates. */
export const MAP_SOURCES = {
    STOPS: 'city-stops',
    STATIONS: 'stop-stations',
    VEHICLES: 'city-vehicles',
    SELECTED_VEHICLE: 'selected-vehicle',
    ROUTE_SHAPE: 'route-shape',
    USER_LOCATION: 'user-location',
    POINTS_OF_SALE: 'points-of-sale-source',
} as const;

/** Canvas-drawn images registered by lib/map/icons.ts. */
export const MAP_ICONS = {
    VEHICLE_ARROW: 'v-arrow-centered',
    /** Prefix of the stop badge images (`stop-badge:<city>:<badges>`), drawn on demand by lib/map/stopBadges.ts. */
    STOP_BADGE_PREFIX: 'stop-badge:',
    POS_MACHINE: 'pos-machine-icon',
    POS_INFO: 'pos-info-icon',
    POS_OFFICE: 'pos-office-icon',
} as const;

export const MAP_LAYERS = {
    STOP_CLUSTERS: 'clusters',
    STATION_DOTS: 'station-dots',
    STATION_BADGES: 'station-badges',
    STATION_LABELS: 'station-labels',
    PLATFORM_BADGES: 'platform-badges',
    STOP_ENTRANCES: 'entrance-layer',
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
export const STOP_CLICK_LAYERS: string[] = [MAP_LAYERS.STATION_DOTS, MAP_LAYERS.STATION_BADGES, MAP_LAYERS.STATION_LABELS, MAP_LAYERS.PLATFORM_BADGES];
/** Layers whose click opens a vehicle's detail. */
export const VEHICLE_CLICK_LAYERS: string[] = [MAP_LAYERS.VEHICLE_POINTS, MAP_LAYERS.VEHICLE_DIRECTIONS, MAP_LAYERS.VEHICLE_LABELS];
export const INTERACTIVE_LAYER_IDS: string[] = [...STOP_CLICK_LAYERS, MAP_LAYERS.STOP_CLUSTERS, ...VEHICLE_CLICK_LAYERS, MAP_LAYERS.POINTS_OF_SALE];

/** Stop badges: one rounded tile per mode serving the stop, in each mode's colour. */
export const STOP_BADGE = {
    /** Tile edge in CSS pixels at icon-size 1; a station's tiles join into one pill. */
    TILE_PX: 24,
    /** Line between joined tiles, so two same-coloured modes still read as two. */
    DIVIDER_PX: 1,
    DIVIDER_COLOR: 'rgba(0, 0, 0, 0.35)',
    /** A favourite's star on the pill's top-right corner, as fractions of the tile edge. */
    STAR_RADIUS_SCALE: 0.36,
    STAR_MARGIN_SCALE: 0.4,
    STAR_COLOR: '#f59e0b',
    STAR_OUTLINE: '#111111',
    PIXEL_RATIO: 2,
    /** Corner radius and glyph size as fractions of the tile edge. */
    RADIUS_SCALE: 0.22,
    GLYPH_SCALE: 0.66,
    MODE_COLORS: {
        metro: '#E8710A',
        train: '#1F3F8F',
        tram: '#C8102E',
        trolleybus: '#13856B',
        bus: '#1C7CC0',
        ferry: '#6B3FA0',
        funicular: '#8A5A2B',
        unknown: '#64748B',
    } satisfies Record<RouteType, string>,
} as const;

const MAP_FONT_STACK = ['Montserrat Medium', 'Arial Unicode MS Regular'];
const LOCATION_TYPE: ExpressionSpecification = ['to-number', ['coalesce', ['get', 'location_type'], 0]];
/** A stop's city: its own `city_slug` for a neighbouring network's stop, else the selected city. */
const stopCity = (selectedCity: string): ExpressionSpecification => ['coalesce', ['get', 'city_slug'], selectedCity];

/** The badge image of a stop, in its city's mode colours, starred when its id is in `starredIds`. */
export const stopBadgeImage = (selectedCity: string, starredIds: readonly string[] = []): ExpressionSpecification =>
    ['concat', MAP_ICONS.STOP_BADGE_PREFIX, stopCity(selectedCity), ':',
        ['case', ['in', ['get', 'stop_id'], ['literal', starredIds]], '*', ''], ':',
        ['coalesce', ['get', 'badges'], '']];

/** Draw order of overlapping platform badges: by leading mode, a starred one on top so its star stays visible. */
export const platformSortKey = (starredIds: readonly string[]): ExpressionSpecification =>
    ['+', ['coalesce', ['get', 'mode_rank'], 99], ['case', ['in', ['get', 'stop_id'], ['literal', starredIds]], 1000, 0]];

/** The colour of a stop's leading mode in its city's mode colours, read from its `mode_rank`. */
export const leadingModeColor = (selectedCity: string, modeColors: (city: string) => Record<RouteType, string>, cities: string[]): ExpressionSpecification => {
    const palette = (city: string) => ['literal', [...ROUTE_TYPE_ORDER.map(mode => modeColors(city)[mode]), modeColors(city).unknown]];
    return ['to-color', ['at',
        ['coalesce', ['get', 'mode_rank'], ROUTE_TYPE_ORDER.length],
        ['match', stopCity(selectedCity), ...cities.flatMap(city => [city, palette(city)]), palette('')],
    ]] as ExpressionSpecification;
};

const MAP_TOKENS = {
    zoom: {
        vehicles: { min: 10, max: 15 },
        /** Stations cluster up to this zoom, like the platforms did before them. */
        clusterMax: 13,
        /** Stations are drawn as mode badges from here, as dots below it; clusters end just before. */
        badges: 14,
        /** Station names show from here; a whole zoom, since layout steps are read at the tile's zoom. */
        labels: 15,
        /** From here a station splits into its platforms. */
        platforms: 16,
    },
    colors: {
        glow: '#000000',
        stroke: '#000000',
        blueCluster: '#1e3a8a',
        routeDefault: '#ffffff',
        favorite: '#f59e0b',
        vehicleLabelText: '#f8fafc',
        stopIconHalo: '#000000',
        platformText: '#cbd5e1'
    },
    route: {
        /** How far a travelled segment's colour is blended toward `traversedTarget`; drawn opaque so streets and casing do not muddy it. */
        traversedMix: { dark: 0.5, light: 0.6 },
        /** Travelled segments are drawn at this fraction of the route line's width. */
        traversedWidthScale: 0.85,
        traversedCasingOpacity: 0.5,
        /** Dark theme washes out toward mid grey, since fading toward its background would make dark feed colours vanish. */
        traversedTarget: { dark: '#52525b', light: '#f4f4f5' },
    },
};

/** Zoom up to which stations are clustered. */
export const STATION_CLUSTER_MAX_ZOOM = MAP_TOKENS.zoom.clusterMax;


// -----------------------------------------------------------------------------
// STOPS & STATIONS
// -----------------------------------------------------------------------------

const UNCLUSTERED: ExpressionSpecification = ['!', ['has', 'point_count']];
const STATION_NAME_TEXT = {
    'text-font': MAP_FONT_STACK,
    'text-letter-spacing': 0.15,
    'text-max-width': 7,
    'text-justify': 'center',
} as const;
/** A wide, sharp halo, since a station's name often lies on the vehicles waiting at it. */
const STATION_NAME_PAINT = {
    'text-color': '#bdbdbd',
    'text-halo-color': '#111111',
    'text-halo-width': 2,
    'text-halo-blur': 0.25,
} as const;
/** Badge scale across the zoom range in which stations are drawn whole. */
const badgeSize = (atLow: number, atHigh: number): ExpressionSpecification =>
    ['interpolate', ['linear'], ['zoom'], MAP_TOKENS.zoom.badges, atLow, MAP_TOKENS.zoom.platforms, atHigh];

const clusterModeCount = (mode: RouteType) => `modes_${mode}`;

/** Each cluster counts its stations by leading mode, so it can take the colour most of them share. */
export const STATION_CLUSTER_PROPERTIES = Object.fromEntries(ROUTE_TYPE_ORDER.map((mode, rank) =>
    [clusterModeCount(mode), ['+', ['case', ['==', ['coalesce', ['get', 'mode_rank'], -1], rank], 1, 0]]]));

/** A cluster's colour: that of the mode most of its stations lead with, in the city's mode colours. */
export const clusterModeColor = (colors: Record<RouteType, string>): ExpressionSpecification => {
    const count = (mode: RouteType): ExpressionSpecification => ['get', clusterModeCount(mode)];
    const wins = ROUTE_TYPE_ORDER.flatMap(mode => [
        ['all', ...ROUTE_TYPE_ORDER.filter(other => other !== mode).map(other => ['>=', count(mode), count(other)])],
        colors[mode],
    ]);
    return ['case', ...wins, colors.unknown] as ExpressionSpecification;
};

export const stopClusters: CircleLayerSpecification = {
    id: MAP_LAYERS.STOP_CLUSTERS,
    type: 'circle',
    source: MAP_SOURCES.STATIONS,
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
        'circle-blur': 1.0
    }
};

/** Below the badges' zoom, a station is a dot in its leading mode's colour (`leadingModeColor`). */
export const stationDots: CircleLayerSpecification = {
    id: MAP_LAYERS.STATION_DOTS,
    type: 'circle',
    source: MAP_SOURCES.STATIONS,
    maxzoom: MAP_TOKENS.zoom.badges,
    filter: UNCLUSTERED,
    paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2.5, MAP_TOKENS.zoom.badges, 4.5],
        'circle-color': MAP_TOKENS.colors.blueCluster,
        'circle-stroke-width': 1,
        'circle-stroke-color': MAP_TOKENS.colors.stroke,
        'circle-opacity': 0.9,
        'circle-stroke-opacity': 0.8,
    }
};

/**
 * A station as one badge of its modes, with its name above or below it from `zoom.labels`. Badges that
 * collide give way by mode rank; a name that fits neither above nor below is dropped, never laid over a badge.
 */
export const stationBadges: SymbolLayerSpecification = {
    id: MAP_LAYERS.STATION_BADGES,
    type: 'symbol',
    source: MAP_SOURCES.STATIONS,
    minzoom: MAP_TOKENS.zoom.badges,
    maxzoom: MAP_TOKENS.zoom.platforms,
    filter: UNCLUSTERED,
    layout: {
        ...STATION_NAME_TEXT,
        'icon-image': stopBadgeImage(''),
        'icon-size': badgeSize(0.6, 0.9),
        'icon-padding': 2,
        'text-field': ['step', ['zoom'], '', MAP_TOKENS.zoom.labels, ['get', 'stop_name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], MAP_TOKENS.zoom.labels, 10, MAP_TOKENS.zoom.platforms, 12],
        'text-variable-anchor': ['top', 'bottom'],
        'text-radial-offset': 1.3,
        'text-padding': 4,
        'text-optional': true,
        'symbol-sort-key': ['coalesce', ['get', 'mode_rank'], 99],
    },
    paint: {
        ...STATION_NAME_PAINT,
        'icon-opacity': ['interpolate', ['linear'], ['zoom'], MAP_TOKENS.zoom.badges, 0, MAP_TOKENS.zoom.badges + 0.3, 1, MAP_TOKENS.zoom.platforms - 0.3, 1, MAP_TOKENS.zoom.platforms, 0],
        'text-opacity': ['interpolate', ['linear'], ['zoom'], MAP_TOKENS.zoom.platforms - 0.3, 1, MAP_TOKENS.zoom.platforms, 0],
    }
};

/** A station's name once its platforms are drawn apart, beside them rather than on them: a one-platform station's badge sits on its point. */
export const stationLabels: SymbolLayerSpecification = {
    id: MAP_LAYERS.STATION_LABELS,
    type: 'symbol',
    source: MAP_SOURCES.STATIONS,
    minzoom: MAP_TOKENS.zoom.platforms,
    filter: UNCLUSTERED,
    layout: {
        ...STATION_NAME_TEXT,
        'text-field': ['get', 'stop_name'],
        'text-size': ['interpolate', ['linear'], ['zoom'], MAP_TOKENS.zoom.platforms, 12, 18, 14],
        'text-variable-anchor': ['bottom', 'top', 'left', 'right'],
        'text-radial-offset': 1.6,
        'text-padding': 6,
        'symbol-sort-key': ['coalesce', ['get', 'mode_rank'], 99],
    },
    paint: STATION_NAME_PAINT,
};

/** Each platform as a badge of its modes with its platform code beside it. */
export const platformBadges: SymbolLayerSpecification = {
    id: MAP_LAYERS.PLATFORM_BADGES,
    type: 'symbol',
    source: MAP_SOURCES.STOPS,
    minzoom: MAP_TOKENS.zoom.platforms,
    filter: ['!=', LOCATION_TYPE, 2],
    layout: {
        'icon-image': stopBadgeImage(''),
        'icon-size': ['interpolate', ['linear'], ['zoom'], MAP_TOKENS.zoom.platforms, 0.8, 18, 1],
        'icon-allow-overlap': true,
        'text-field': ['coalesce', ['get', 'platform_code'], ''],
        'text-font': MAP_FONT_STACK,
        'text-size': ['interpolate', ['linear'], ['zoom'], MAP_TOKENS.zoom.platforms, 11, 18, 13],
        'text-anchor': 'top',
        'text-offset': [0, 1.2],
        'text-allow-overlap': true,
        'symbol-sort-key': ['coalesce', ['get', 'mode_rank'], 99],
    },
    paint: {
        'text-color': MAP_TOKENS.colors.platformText,
        'text-halo-color': MAP_TOKENS.colors.stopIconHalo,
        'text-halo-width': 0.8,
        'text-halo-blur': 0.2,
        'icon-opacity': ['interpolate', ['linear'], ['zoom'], MAP_TOKENS.zoom.platforms, 0, MAP_TOKENS.zoom.platforms + 0.3, 1],
        'text-opacity': ['interpolate', ['linear'], ['zoom'], MAP_TOKENS.zoom.platforms, 0, MAP_TOKENS.zoom.platforms + 0.3, 1],
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

// -----------------------------------------------------------------------------
// VEHICLES (Factories)
// -----------------------------------------------------------------------------

export const getVehicleColorExpression = (colorVehiclesByDelay: boolean): ExpressionSpecification => {
    if (!colorVehiclesByDelay) {
        return ROUTE_COLOR;
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
            'circle-color': ROUTE_COLOR,
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
            'icon-color': ROUTE_COLOR,
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
        'circle-color': ROUTE_COLOR
    }
};

// -----------------------------------------------------------------------------
// ROUTES
// -----------------------------------------------------------------------------

const isTraversedSegment: ExpressionSpecification = ['==', ['get', 'status'], 'traversed'];

/** Outlines both parts of the route line, so a feed colour close to the map background (Brno's black night lines) stays visible. */
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
        'line-width': ['interpolate', ['linear'], ['zoom'],
            MAP_TOKENS.zoom.vehicles.min, ['case', isTraversedSegment, 4 * MAP_TOKENS.route.traversedWidthScale, 4],
            MAP_TOKENS.zoom.vehicles.max, ['case', isTraversedSegment, 8 * MAP_TOKENS.route.traversedWidthScale, 8],
        ],
        'line-opacity': ['case', isTraversedSegment, MAP_TOKENS.route.traversedCasingOpacity, 0.8]
    }
};

/** The route line; its travelled part is a flat washed-out shade of `routeColor` for `theme`. */
export const createRouteLine = (routeColor: string | null, theme: 'dark' | 'light'): LineLayerSpecification => {
    const traversedColor = routeColor ? mixHex(routeColor, MAP_TOKENS.route.traversedTarget[theme], MAP_TOKENS.route.traversedMix[theme]) : null;
    return {
        id: MAP_LAYERS.ROUTE_LINE,
        type: 'line',
        source: MAP_SOURCES.ROUTE_SHAPE,
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: {
            'line-join': 'round',
            'line-cap': 'round'
        },
        paint: {
            'line-color': traversedColor
                ? ['case', isTraversedSegment, traversedColor, ROUTE_COLOR]
                : ROUTE_COLOR,
            'line-width': ['interpolate', ['linear'], ['zoom'],
                MAP_TOKENS.zoom.vehicles.min, ['case', isTraversedSegment, 2.5 * MAP_TOKENS.route.traversedWidthScale, 2.5],
                MAP_TOKENS.zoom.vehicles.max, ['case', isTraversedSegment, 6 * MAP_TOKENS.route.traversedWidthScale, 6],
            ],
            'line-opacity': traversedColor ? 1 : ['case', isTraversedSegment, 0.4, 1.0]
        }
    };
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
            'circle-stroke-color': ROUTE_COLOR,
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
