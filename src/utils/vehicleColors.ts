import type { ExpressionSpecification } from 'maplibre-gl';
import { TRANSIT_CONFIG } from '../config/constants';

/**
 * Determines if a route is a night route based on its number.
 * Trams 90-99 and Buses 900+ are considered night routes.
 */
export const isNightRoute = (routeName: string | number): boolean => {
    const nameStr = String(routeName);
    const nameNum = parseInt(nameStr, 10);
    if (isNaN(nameNum)) return false;
    return (nameNum >= TRANSIT_CONFIG.NIGHT_TRAM_MIN && nameNum <= TRANSIT_CONFIG.NIGHT_TRAM_MAX) || nameNum >= TRANSIT_CONFIG.NIGHT_BUS_MIN;
};

/**
 * Returns a hex color string for a given route type and name.
 * Uses PID official branding colors for Metro, Trams, and Buses.
 */
export const getVehicleColor = (routeType: string | number, routeName: string): string => {
    const type = String(routeType).toLowerCase();
    const nameStr = String(routeName);

    // 1. Metro Specifics (Priority)
    if (type === '1' || type === 'metro') {
        switch (nameStr.toUpperCase()) {
            case 'A': return '#00A651'; // Green
            case 'B': return '#F9B233'; // Yellow
            case 'C': return '#E31E24'; // Red
        }
    }

    // 2. Night Routes (Trams 90-99, Buses 900+)
    if (isNightRoute(nameStr)) {
        return '#111827'; // Dark Night
    }

    // 3. Fallback by Type
    switch (type) {
        case '0':
        case 'tram':
            return '#930019'; // Tram Red/Bordeaux
        case '1':
        case 'metro':
            return '#AD0B00'; // Default Metro Red
        case '11':
        case 'trolleybus':
            return '#A21CAF'; // Trolleybus Purple
        case '3':
        case 'bus':
            return '#005CBF'; // Bus Blue
        case '109':
        case 'train':
            return '#002D5A'; // Train Navy Blue
        default:
            return '#5A5A5A'; // Grey fallback
    }
};

/**
 * MapLibre expression to detect night routes in vector layers.
 * Synchronized with isNightRoute logic.
 */
export const isNightRouteExpression: ExpressionSpecification = [
    'any',
    // Trams 90-99
    ['match', ['to-string', ['coalesce', ['get', 'gtfs_route_short_name'], ['get', 'route_short_name'], ['get', 'n'], '']], Array.from({ length: TRANSIT_CONFIG.NIGHT_TRAM_MAX - TRANSIT_CONFIG.NIGHT_TRAM_MIN + 1 }, (_, i) => String(TRANSIT_CONFIG.NIGHT_TRAM_MIN + i)), true, false],
    // Buses 9xx (Length 3, Starts with 9)
    ['all',
        ['==', ['length', ['to-string', ['coalesce', ['get', 'gtfs_route_short_name'], ['get', 'route_short_name'], ['get', 'n'], '']]], TRANSIT_CONFIG.NIGHT_BUS_LENGTH],
        ['==', ['slice', ['to-string', ['coalesce', ['get', 'gtfs_route_short_name'], ['get', 'route_short_name'], ['get', 'n'], '']], 0, 1], TRANSIT_CONFIG.NIGHT_BUS_PREFIX]
    ]
];

/**
 * MapLibre expression for dynamic vehicle coloring based on route type and name.
 * Used for styling 'pid-vehicles' and 'selected-vehicle' sources.
 */
export const vehicleColorExpression: ExpressionSpecification = [
    'case',
    // 1. Metro Specifics (Priority)
    ['any',
        ['==', ['to-string', ['get', 'gtfs_route_short_name']], 'A'],
        ['==', ['to-string', ['get', 'route_short_name']], 'A'],
        ['==', ['to-string', ['get', 'n']], 'A']
    ], '#00A651',
    ['any',
        ['==', ['to-string', ['get', 'gtfs_route_short_name']], 'B'],
        ['==', ['to-string', ['get', 'route_short_name']], 'B'],
        ['==', ['to-string', ['get', 'n']], 'B']
    ], '#F9B233',
    ['any',
        ['==', ['to-string', ['get', 'gtfs_route_short_name']], 'C'],
        ['==', ['to-string', ['get', 'route_short_name']], 'C'],
        ['==', ['to-string', ['get', 'n']], 'C']
    ], '#E31E24',

    // 2. Night Routes Detection (90-99 or 9xx)
    isNightRouteExpression, '#111827',

    // 3. Type-based fallback (Ensure 't' is treated as string)
    ['match', ['to-string', ['coalesce', ['get', 'route_type'], ['get', 't'], '']],
        '0', '#930019', 'tram', '#930019',
        '1', '#AD0B00', 'metro', '#AD0B00',
        '3', '#005CBF', 'bus', '#005CBF',
        '11', '#A21CAF', 'trolleybus', '#A21CAF',
        '109', '#002D5A', 'train', '#002D5A',
        '#5A5A5A'
    ]
];
