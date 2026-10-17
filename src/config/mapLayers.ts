import type {
    CircleLayerSpecification,
    SymbolLayerSpecification,
    LineLayerSpecification,
    ExpressionSpecification
} from 'maplibre-gl';
import type { RouteType } from '@/types';
import { DELAY_TIERS } from './transit';
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
    /** Prefix of the stop badge images (`stop-badge:<city>:<star>:<badges>`), drawn on demand by lib/map/stopBadges.ts. */
    STOP_BADGE_PREFIX: 'stop-badge:',
    POS_MACHINE: 'pos-machine-icon',
    POS_INFO: 'pos-info-icon',
    POS_OFFICE: 'pos-office-icon',
} as const;

export const MAP_LAYERS = {
    STOP_CLUSTERS: 'clusters',
    STATION_BADGES: 'station-badges',
    STATION_NAMES: 'station-names',
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
export const STOP_CLICK_LAYERS: string[] = [MAP_LAYERS.STATION_BADGES, MAP_LAYERS.STATION_NAMES, MAP_LAYERS.PLATFORM_BADGES];
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
    /** A platform's code: a white circle beside its pill, sized and spaced as fractions of the tile edge. */
    CODE_FILL: '#f8fafc',
    CODE_INK: '#0f172a',
    CODE_GAP_SCALE: 0.12,
    /** Lettering of metro lines and platform codes: the app's UI face, sized by character count as fractions of the shape. */
    FONT: '"Geist Variable", Arial, sans-serif',
    LETTER_SCALES: [0.62, 0.5, 0.4],
    /** A circle's share of its square's room for lettering, so a code keeps a margin round it. */
    CIRCLE_LETTER_INSET: 0.82,
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
const MAP_TOKENS = {
    zoom: {
        vehicles: { min: 10, max: 15 },
        /** Stations cluster up to this zoom, like the platforms did before them. */
        clusterMax: 13,
        /** Stations are drawn as mode badges from here, where the clusters end. */
        badges: 13,
        /** Station names show from here; a whole zoom, since layout steps are read at the tile's zoom. */
        labels: 14,
        /** From here a station's platforms take over from its badge. */
        platforms: 16,
    },
    colors: {
        stroke: '#000000',
        blueCluster: '#1e3a8a',
        routeDefault: '#ffffff',
        vehicleLabelText: '#f8fafc',
    },
    /** How much stations and platforms grow from the platforms' zoom to zoom 18. */
    platformGrowth: 1.25,
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
    'text-letter-spacing': 0.05,
    'text-max-width': 8,
    'text-justify': 'center',
} as const;
/** One size curve for a station's name, drawn by the badge layer below `zoom.platforms` and the name layer above it. */
const STATION_NAME_SIZE: ExpressionSpecification =
    ['interpolate', ['linear'], ['zoom'], MAP_TOKENS.zoom.labels, 11, MAP_TOKENS.zoom.platforms, 13, 18, 15];
/** A soft halo, still wide enough to read a name lying on the vehicles waiting at its station. */
const STATION_NAME_PAINT = {
    'text-color': '#bdbdbd',
    'text-halo-color': '#111111',
    'text-halo-width': 1.5,
    'text-halo-blur': 0.5,
} as const;
/** Badge scale across the zoom range in which stations are drawn whole. */
const badgeSize = (atLow: number, atHigh: number): ExpressionSpecification =>
    ['interpolate', ['linear'], ['zoom'], MAP_TOKENS.zoom.badges, atLow, MAP_TOKENS.zoom.platforms, atHigh, 18, atHigh * MAP_TOKENS.platformGrowth];

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

/**
 * A station as one badge of its modes, with its name above or below it from `zoom.labels`. Badges that
 * collide give way by mode rank; a name that fits neither above nor below is dropped, never laid over a badge.
 */
export const stationBadges: SymbolLayerSpecification = {
    id: MAP_LAYERS.STATION_BADGES,
    type: 'symbol',
    source: MAP_SOURCES.STATIONS,
    // No minzoom: below the badges' zoom a station the clusters leave alone is still drawn, at the smallest size.
    // Hands over to its platforms at one zoom, with no crossfade in which both are too faint to read.
    maxzoom: MAP_TOKENS.zoom.platforms,
    filter: UNCLUSTERED,
    layout: {
        ...STATION_NAME_TEXT,
        'icon-size': badgeSize(0.6, 0.9),
        'icon-padding': 2,
        'text-field': ['step', ['zoom'], '', MAP_TOKENS.zoom.labels, ['get', 'stop_name']],
        'text-size': STATION_NAME_SIZE,
        // Only below or above: the offset counts from the point, and a badge of several tiles is wider than any side offset.
        'text-variable-anchor': ['top', 'bottom'],
        // Close under or over the badge, as its caption.
        'text-radial-offset': 1.3,
        'text-padding': 4,
        'text-optional': true,
        'symbol-sort-key': ['coalesce', ['get', 'mode_rank'], 99],
    },
    paint: {
        ...STATION_NAME_PAINT,
    }
};

/**
 * A station's name once its platforms carry the badges: on its point when that is free, else beside it,
 * set as the badge layer set it below this zoom.
 */
export const stationNames: SymbolLayerSpecification = {
    id: MAP_LAYERS.STATION_NAMES,
    type: 'symbol',
    source: MAP_SOURCES.STATIONS,
    minzoom: MAP_TOKENS.zoom.platforms,
    filter: UNCLUSTERED,
    layout: {
        ...STATION_NAME_TEXT,
        'text-field': ['get', 'stop_name'],
        'text-size': STATION_NAME_SIZE,
        // Clear of the platform pills that usually sit on the station's point: above or below them first.
        'text-variable-anchor': ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'],
        // Moves off the point as the platform pills around it grow.
        'text-radial-offset': ['interpolate', ['linear'], ['zoom'], MAP_TOKENS.zoom.platforms, 1.8, 18, 2.8],
        // Keeps neighbouring names apart among the platform pills, so a dense centre is not a wall of text.
        'text-padding': 15,
        'symbol-sort-key': ['coalesce', ['get', 'mode_rank'], 99],
    },
    paint: STATION_NAME_PAINT,
};

/** Each platform as a pill of its modes (a metro platform: its line) with its code in a circle beside it. */
export const platformBadges: SymbolLayerSpecification = {
    id: MAP_LAYERS.PLATFORM_BADGES,
    type: 'symbol',
    source: MAP_SOURCES.STOPS,
    minzoom: MAP_TOKENS.zoom.platforms,
    filter: ['!=', LOCATION_TYPE, 2],
    layout: {
        // Takes over from its station's badge at the same scale, and grows from there.
        'icon-size': badgeSize(0.6, 0.9),
        'icon-allow-overlap': true,
        'symbol-sort-key': ['coalesce', ['get', 'mode_rank'], 99],
    },
};

export const stopEntrances: SymbolLayerSpecification = {
    id: MAP_LAYERS.STOP_ENTRANCES,
    type: 'symbol',
    source: MAP_SOURCES.STOPS,
    filter: ['all',
        ['!', ['has', 'point_count']],
        ['==', LOCATION_TYPE, 2]
    ],
    // Not before the platforms: an entrance's name would push the station badges out of placement.
    minzoom: MAP_TOKENS.zoom.platforms,
    layout: {
        'text-field': ['get', 'stop_name'],
        'text-font': MAP_FONT_STACK,
        'text-size': ['interpolate', ['linear'], ['zoom'], MAP_TOKENS.zoom.platforms, 8, 18, 10],
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
        'text-opacity': ['interpolate', ['linear'], ['zoom'], MAP_TOKENS.zoom.platforms, 0, MAP_TOKENS.zoom.platforms + 0.5, 1]
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
